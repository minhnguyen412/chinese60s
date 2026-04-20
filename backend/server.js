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

    console.log('=== DELETE WORD DEBUG ===');
    console.log('UID:', uid);
    console.log('Character received:', character);
    console.log('Character bytes:', Buffer.from(character).toString('hex'));

    const { data: lessons, error: fetchErr } = await supabase
      .from('lessons')
      .select('id, images')
      .eq('user_id', uid)
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (!lessons || lessons.length === 0) {
      console.error('No lessons found');
      return res.status(404).json({ error: 'No lesson found' });
    }

    const lesson = lessons[0];
    console.log('Current images:', JSON.stringify(lesson.images, null, 2));

    // Filter
    const updatedImages = lesson.images.filter(item => {
      const match = item.character === character;
      console.log(`Comparing "${item.character}" (${Buffer.from(item.character).toString('hex')}) with "${character}" (${Buffer.from(character).toString('hex')}) = ${match}`);
      return !match; // ✅ Giữ những cái KHÔNG match
    });

    console.log('Updated images:', JSON.stringify(updatedImages, null, 2));
    console.log('Deleted count:', lesson.images.length - updatedImages.length);

    // Update
    const { error: updateErr } = await supabase
      .from('lessons')
      .update({ images: updatedImages })
      .eq('id', lesson.id);

    if (updateErr) {
      console.error('Update error:', updateErr);
      throw updateErr;
    }

    console.log('✅ Successfully deleted');
    res.json({ success: true, message: 'Word deleted' });

  } catch (error) {
    console.error('[delete-word] Error:', error);
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
