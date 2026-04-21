// ============================================
// backend/server.js - Node.js + Express
// Firebase Auth + Supabase Database
// ============================================

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// ─────────────────────────────────────────
// CORS CONFIG - FIXED
// ─────────────────────────────────────────

const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3000',
  'https://chinese60s.com',
  'https://www.chinese60s.com',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []), // ✅ Properly spread
];

console.log('✅ Allowed origins:', allowedOrigins);

// Main CORS middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ✅ FIXED: Preflight OPTIONS handler - properly reject instead of allow all
app.options('*', cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// ─────────────────────────────────────────
// FIREBASE ADMIN
// ─────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(
    process.env.FIREBASE_KEY 
      ? JSON.parse(process.env.FIREBASE_KEY)
      : require('./firebase-key.json')
  ),
});

const auth = admin.auth();

// ─────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
// ✅ Thêm route này VÀO ĐÂY (trước submit)
app.get('/api/lesson-count', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    const { count, error } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);

    if (error) throw error;

    res.json({ 
      success: true, 
      count: count || 0 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Submit lesson content
app.post('/api/submit', verifyFirebaseToken, upload.any(), async (req, res) => {
  try {
    const uid = req.user.uid;
    const { posts, quiz, images } = req.body;

    // Parse JSON strings
    let postsData = [];
    let quizData = [];
    let imagesData = [];

    try {
      if (posts) postsData = JSON.parse(posts);
      if (quiz) quizData = JSON.parse(quiz);
      if (images) imagesData = JSON.parse(images);
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON in body' });
    }

    // ═══ FILE UPLOAD (Optional - Supabase Storage) ═══
    const fileUrls = {};

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filename = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
        
        try {
          const { data, error } = await supabase.storage
            .from('lesson-files')
            .upload(filename, file.buffer, {
              contentType: file.mimetype,
            });

          if (error) throw error;
          
          const { data: publicUrl } = supabase.storage
            .from('lesson-files')
            .getPublicUrl(data.path);
          
          fileUrls[file.fieldname] = publicUrl.publicUrl;
        } catch (uploadErr) {
          console.warn(`File upload failed for ${file.originalname}:`, uploadErr.message);
          // Continue despite file upload failure
        }
      }
    }

    // ═══ INSERT INTO SUPABASE ═══
    const { data, error } = await supabase
      .from('lessons')
      .insert([
        {
          user_id: uid,
          posts: postsData,
          quiz: quizData,
          images: imagesData,
          file_urls: fileUrls,
          submitted_at: new Date().toISOString(),
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save to database: ' + error.message });
    }

    res.json({
      success: true,
      message: 'Content submitted successfully',
      data: data[0],
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch user's lessons
app.get('/api/lessons', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('user_id', uid)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a lesson
app.delete('/api/lessons/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const lessonId = req.params.id;

    // Verify ownership
    const { data: lesson, error: fetchErr } = await supabase
      .from('lessons')
      .select('user_id')
      .eq('id', lessonId)
      .single();

    if (fetchErr || lesson.user_id !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete
    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId);

    if (error) throw error;

    res.json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Update user subscription
app.post('/api/update-subscription', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { plan, expireDate } = req.body;

    // Tạo hoặc update record trong Supabase
    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert([
        {
          user_id: uid,
          plan: plan,
          activated_at: new Date().toISOString(),
          expires_at: expireDate,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id' })
      .select();

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Subscription updated',
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user subscription
app.get('/api/user-subscription', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', uid)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ 
      success: true, 
      data: data || { plan: 'free' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Delete a word from images
app.post('/api/delete-word', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { character } = req.body;

    // ✅ Xóa filter submitted_at
    const { data: lessons, error: fetchErr } = await supabase
      .from('lessons')
      .select('id, images')
      .eq('user_id', uid)
      .order('submitted_at', { ascending: false });
      // .limit(1); ← Bỏ limit để lấy tất cả

    if (fetchErr || !lessons || lessons.length === 0) {
      return res.status(404).json({ error: 'No lesson found' });
    }

    // ✅ Tìm lesson chứa character cần xóa
    let targetLesson = null;
    for (let lesson of lessons) {
      if (lesson.images.some(img => img.character === character)) {
        targetLesson = lesson;
        break;
      }
    }

    if (!targetLesson) {
      return res.status(404).json({ error: 'Word not found' });
    }

    const updatedImages = targetLesson.images.filter(item => item.character !== character);

    const { error: updateErr } = await supabase
      .from('lessons')
      .update({ images: updatedImages })
      .eq('id', targetLesson.id);

    if (updateErr) throw updateErr;

    res.json({ success: true, message: 'Word deleted' });
  } catch (error) {
    console.error('[delete-word] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
// ═══ WORKSHEET PRINT TRACKING ═══

// Get print count for current month
app.get('/api/worksheet-print-count', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Get subscription info
    const { data: subData } = await supabase
      .from('worksheet_subscriptions')
      .select('plan, expires_at')
      .eq('user_id', uid)
      .single();

    const plan = subData?.plan || 'free';
    const expiresAt = subData?.expires_at;

    // Check if expired
    if (plan !== 'free' && expiresAt) {
      const now = new Date();
      const expireDate = new Date(expiresAt);
      
      if (now > expireDate) {
        // Auto downgrade
        await supabase
          .from('worksheet_subscriptions')
          .update({ plan: 'free' })
          .eq('user_id', uid);
        
        return res.json({
          success: true,
          plan: 'free',
          printCount: 0,
          maxPrints: 10,
          expired: true,
          message: 'Subscription expired - downgraded to Free'
        });
      }
    }

    // Count prints in this month (for free users)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error } = await supabase
      .from('worksheet_prints')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('printed_at', monthStart);

    if (error && error.code !== 'PGRST116') throw error;

    const printCount = count || 0;
    const maxPrints = plan === 'free' ? 10 : 999;

    res.json({
      success: true,
      plan,
      printCount,
      maxPrints,
      expiresAt: expiresAt || null,
      expired: false
    });

  } catch (error) {
    console.error('[worksheet-print-count] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record a print action
app.post('/api/worksheet-record-print', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    // Get subscription & print count
    const { data: subData } = await supabase
      .from('worksheet_subscriptions')
      .select('plan, expires_at')
      .eq('user_id', uid)
      .single();

    const plan = subData?.plan || 'free';

    // Check expiration
    if (plan !== 'free' && subData?.expires_at) {
      const now = new Date();
      const expireDate = new Date(subData.expires_at);
      
      if (now > expireDate) {
        // Auto downgrade
        await supabase
          .from('worksheet_subscriptions')
          .update({ plan: 'free' })
          .eq('user_id', uid);
        
        return res.status(403).json({
          error: 'Subscription expired',
          plan: 'free',
          maxPrints: 10
        });
      }
    }

    // Check limit (free users only)
    if (plan === 'free') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count, error: countErr } = await supabase
        .from('worksheet_prints')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .gte('printed_at', monthStart);

      if (countErr && countErr.code !== 'PGRST116') throw countErr;

      if ((count || 0) >= 10) {
        return res.status(403).json({
          error: 'Print limit reached',
          plan: 'free',
          printCount: count,
          maxPrints: 10
        });
      }
    }

    // Record print
    const { data, error } = await supabase
      .from('worksheet_prints')
      .insert([
        {
          user_id: uid,
          plan: plan,
          printed_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Print recorded',
      data: data[0]
    });

  } catch (error) {
    console.error('[worksheet-record-print] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate Gumroad key cho worksheet
app.post('/api/validate-worksheet-key', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { license_key } = req.body;

    if (!license_key) {
      return res.status(400).json({ error: 'Missing license key' });
    }

    // ✅ INTEGRATION POINT: Call Gumroad API để verify
    // Hoặc kiểm tra trong database có key này hay không
    
    // Option 1: Simple check (key pattern)
    if (!license_key || license_key.trim().length < 5) {
      return res.status(400).json({ error: 'Invalid key format' });
    }

    // Option 2: Call Gumroad API (nếu cần verify thật)
    // const gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {...})

    // For now, assume valid key → activate Pro plan
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 40); // 40 days

    const { data, error } = await supabase
      .from('worksheet_subscriptions')
      .upsert([
        {
          user_id: uid,
          plan: 'plan_pro', // For worksheet, just call it "pro"
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          license_key: license_key,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id' })
      .select();

    if (error) throw error;

    res.json({
      success: true,
      plan: 'plan_pro',
      message: 'Worksheet Pro activated for 40 days',
      expiresAt: expiresAt.toISOString(),
      data: data[0]
    });

  } catch (error) {
    console.error('[validate-worksheet-key] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Validate Gumroad key cho Personal Lessons
app.post('/api/validate-subscription-key', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { license_key, expected_plan } = req.body;  // ✅ Thêm expected_plan
    
    if (!license_key) {
      return res.status(400).json({ error: 'Missing license key' });
    }
    
    const trimmedKey = license_key.trim().toUpperCase();
    
    // ✅ Extract plan từ key prefix
    let plan = 'free';
    if (trimmedKey.startsWith('STARTER-')) {
      plan = 'plan_a';
    } else if (trimmedKey.startsWith('PRO-')) {
      plan = 'plan_b';
    } else if (trimmedKey.startsWith('MASTER-')) {
      plan = 'plan_c';
    } else {
      return res.status(400).json({ error: 'Invalid key format. Must start with STARTER-, PRO-, or MASTER-' });
    }
    
    // ✅ THÊM VALIDATION NÀY - Check plan khớp
    if (expected_plan && plan !== expected_plan) {
      return res.status(400).json({ 
        error: `This key is not for ${expected_plan.replace('plan_', '').toUpperCase()} plan` 
      });
    }
    
    // Activate subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 40);
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert([
        {
          user_id: uid,
          plan: plan,
          license_key: trimmedKey,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id' })
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      plan: plan,
      message: `Subscription activated for 40 days (${plan.replace('plan_', '').toUpperCase()})`,
      expiresAt: expiresAt.toISOString(),
      data: data[0]
    });
  } catch (error) {
    console.error('[validate-subscription-key] Error:', error);
    res.status(500).json({ error: error.message });
  }
});
// ─────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   Firebase Auth: ${admin.app().name}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL}`);
});
