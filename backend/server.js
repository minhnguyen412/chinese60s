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
// MIDDLEWARE
// ─────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:8080',
  credentials: true,
}));

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
