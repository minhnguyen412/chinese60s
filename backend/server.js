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
// GET /api/user-limits
app.get('/api/user-limits', authenticateToken, async (req, res) => {
  const uid = req.user.uid;
  
  try {
    // Get subscription plan
    const { data: subData, error: subError } = await supabase
      .from('user_subscription_limits')
      .select('*')
      .eq('uid', uid)
      .single();
    
    if (subError && subError.code !== 'PGRST116') throw subError;
    
    const plan = subData?.subscription_plan || 'free';
    const isExpired = subData?.expires_at && new Date(subData.expires_at) < new Date();
    
    // Get lesson usage
    const { data: usageData } = await supabase
      .from('user_lesson_usage')
      .select('*')
      .eq('uid', uid)
      .single();
    
    // Define plan limits
    const LIMITS = {
      free: { max_lessons: 5, max_questions: 5, price: 0 },
      plan_a: { max_lessons: 10, max_questions: 10, price: 4.99 },
      plan_b: { max_lessons: 20, max_questions: 20, price: 7.99 },
      plan_c: { max_lessons: 50, max_questions: 50, price: 19.99 }
    };
    
    const currentPlan = isExpired ? 'free' : plan;
    const limits = LIMITS[currentPlan];
    
    res.json({
      subscription_plan: currentPlan,
      is_expired: isExpired,
      limits: limits,
      usage: {
        lessons_created: usageData?.total_lessons_created || 0,
        lessons_available: limits.max_lessons - (usageData?.total_lessons_created || 0),
        max_questions_per_lesson: limits.max_questions
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// POST /api/validate-subscription-key
app.post('/api/validate-subscription-key', authenticateToken, async (req, res) => {
  const { license_key } = req.body;
  const uid = req.user.uid;
  
  try {
    // Validate key format
    const keyRegex = /^(STARTER|PRO|MASTER)-[A-Z0-9]{20,}$/i;
    if (!keyRegex.test(license_key)) {
      return res.status(400).json({ error: 'Invalid key format' });
    }
    
    // Check if key already used
    const { data: existing } = await supabase
      .from('user_subscription_limits')
      .select('*')
      .eq('license_key', license_key)
      .neq('uid', uid)
      .single();
    
    if (existing) {
      return res.status(400).json({ error: 'License key already used' });
    }
    
    // Determine plan from key prefix
    const prefix = license_key.split('-')[0].toUpperCase();
    const PLAN_MAP = {
      'STARTER': 'plan_a',
      'PRO': 'plan_b',
      'MASTER': 'plan_c'
    };
    
    const plan = PLAN_MAP[prefix];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid license key prefix' });
    }
    
    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Upsert subscription record
    const { error: upsertError } = await supabase
      .from('user_subscription_limits')
      .upsert({
        uid: uid,
        subscription_plan: plan,
        license_key: license_key,
        activated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'uid' });
    
    if (upsertError) throw upsertError;
    
    // Initialize usage tracker if not exists
    const { data: usageData } = await supabase
      .from('user_lesson_usage')
      .select('*')
      .eq('uid', uid)
      .single();
    
    if (!usageData) {
      await supabase.from('user_lesson_usage').insert({
        uid: uid,
        total_lessons_created: 0,
        lessons_used_this_month: 0
      });
    }
    
    res.json({
      message: `✅ Subscription activated! Plan: ${plan.toUpperCase()}`,
      plan: plan,
      expires_at: expiresAt.toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// POST /api/submit-lesson
app.post('/api/submit-lesson', authenticateToken, async (req, res) => {
  const uid = req.user.uid;
  const { title, posts, quiz, images } = req.body;
  
  try {
    // 1. Get user's current limits
    const { data: subData } = await supabase
      .from('user_subscription_limits')
      .select('*')
      .eq('uid', uid)
      .single();
    
    const plan = subData?.subscription_plan || 'free';
    const LIMITS = {
      free: { max_lessons: 5, max_questions: 5 },
      plan_a: { max_lessons: 10, max_questions: 10 },
      plan_b: { max_lessons: 20, max_questions: 20 },
      plan_c: { max_lessons: 50, max_questions: 50 }
    };
    
    const limits = LIMITS[plan];
    
    // 2. Check lesson count
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id', { count: 'exact' })
      .eq('uid', uid);
    
    if (lessonsError) throw lessonsError;
    
    const lessonsCount = lessons?.length || 0;
    if (lessonsCount >= limits.max_lessons) {
      return res.status(402).json({
        error: `You've reached your limit of ${limits.max_lessons} lessons. Upgrade to create more.`,
        current_plan: plan,
        lessons_created: lessonsCount,
        lessons_limit: limits.max_lessons
      });
    }
    
    // 3. Check question count (quiz items)
    const questionCount = (quiz || []).length;
    if (questionCount > limits.max_questions) {
      return res.status(402).json({
        error: `This lesson has ${questionCount} questions, but your plan allows ${limits.max_questions} max per lesson.`,
        current_plan: plan,
        questions_in_lesson: questionCount,
        questions_limit: limits.max_questions
      });
    }
    
    // 4. Create lesson in database
    const { data: lessonData, error: insertError } = await supabase
      .from('lessons')
      .insert({
        uid: uid,
        title: title,
        description: null,
        posts: posts || [],
        quiz: quiz || [],
        images: images || [],
        question_count: questionCount
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // 5. Update usage tracker
    await supabase
      .from('user_lesson_usage')
      .update({
        total_lessons_created: lessonsCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('uid', uid);
    
    res.json({
      message: '✅ Lesson created successfully!',
      lesson_id: lessonData.id,
      lessons_used: lessonsCount + 1,
      lessons_remaining: limits.max_lessons - (lessonsCount + 1)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
