// ============================================
// backend/server.js - Updated with RLS
// Firebase Auth + Supabase Database (with RLS)
// ============================================

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// ─────────────────────────────────────────
// CORS CONFIG
// ─────────────────────────────────────────

const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3000',
  'https://chinese60s.com',
  'https://www.chinese60s.com',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

console.log('✅ Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

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

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
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
// SUPABASE CLIENTS - DUAL SETUP
// ─────────────────────────────────────────

// Client 1: Anon key (RLS applies - for frontend queries)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Client 2: Service role key (RLS bypassed - for backend operations)
// ⚠️ CRITICAL: SERVICE_ROLE_KEY must NEVER be exposed to frontend
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify keys are configured
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not configured in .env');
  console.error('   Get it from: Supabase Dashboard → Settings → API → Service Role (secret)');
  process.exit(1);
}

console.log('✅ Supabase clients initialized:');
console.log('   - Anon (frontend): RLS enabled');
console.log('   - Service role (backend): RLS bypassed');

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

// Get lesson count
app.get('/api/lesson-count', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // ✅ Use service role to bypass RLS (need to count ALL user's lessons)
    const { count, error } = await supabaseServiceRole
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);

    if (error) throw error;

    res.json({ 
      success: true, 
      count: count || 0 
    });
  } catch (error) {
    console.error('[lesson-count] Error:', error);
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

    // File upload to Supabase Storage
    const fileUrls = {};

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filename = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
        
        try {
          const { data, error } = await supabaseServiceRole.storage
            .from('lesson-files')
            .upload(filename, file.buffer, {
              contentType: file.mimetype,
            });

          if (error) throw error;
          
          const { data: publicUrl } = supabaseServiceRole.storage
            .from('lesson-files')
            .getPublicUrl(data.path);
          
          fileUrls[file.fieldname] = publicUrl.publicUrl;
        } catch (uploadErr) {
          console.warn(`File upload failed for ${file.originalname}:`, uploadErr.message);
        }
      }
    }

    // ✅ INSERT WITH SERVICE ROLE (bypass RLS)
    const { data, error } = await supabaseServiceRole
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
    
    // ✅ Use service role (still checks user_id = uid in app logic)
    const { data, error } = await supabaseServiceRole
      .from('lessons')
      .select('*')
      .eq('user_id', uid)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('[lessons] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a lesson
app.delete('/api/lessons/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const lessonId = req.params.id;

    // ✅ Verify ownership before delete
    const { data: lesson, error: fetchErr } = await supabaseServiceRole
      .from('lessons')
      .select('user_id')
      .eq('id', lessonId)
      .single();

    if (fetchErr || lesson.user_id !== uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete
    const { error } = await supabaseServiceRole
      .from('lessons')
      .delete()
      .eq('id', lessonId);

    if (error) throw error;

    res.json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    console.error('[delete lesson] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user subscription
app.post('/api/update-subscription', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { plan, expireDate } = req.body;

    // ✅ Use service role for subscription update
    const { data, error } = await supabaseServiceRole
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
    console.error('[update-subscription] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user subscription
app.get('/api/user-subscription', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // ✅ Use service role but still filter by user_id
    const { data, error } = await supabaseServiceRole
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
    console.error('[user-subscription] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a word from images
app.post('/api/delete-word', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { character } = req.body;

    // ✅ Use service role to find lesson
    const { data: lessons, error: fetchErr } = await supabaseServiceRole
      .from('lessons')
      .select('id, images')
      .eq('user_id', uid)
      .order('submitted_at', { ascending: false });

    if (fetchErr || !lessons || lessons.length === 0) {
      return res.status(404).json({ error: 'No lesson found' });
    }

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

    // ✅ Update with service role
    const { error: updateErr } = await supabaseServiceRole
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

// ═══ WORKSHEET FUNCTIONS ═══

app.get('/api/worksheet-print-count', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // ✅ Use service role
    const { data: subData } = await supabaseServiceRole
      .from('worksheet_subscriptions')
      .select('plan, expires_at')
      .eq('user_id', uid)
      .single();

    const plan = subData?.plan || 'free';
    const expiresAt = subData?.expires_at;

    if (plan !== 'free' && expiresAt) {
      const now = new Date();
      const expireDate = new Date(expiresAt);
      
      if (now > expireDate) {
        await supabaseServiceRole
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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error } = await supabaseServiceRole
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

app.post('/api/worksheet-record-print', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const { data: subData } = await supabaseServiceRole
      .from('worksheet_subscriptions')
      .select('plan, expires_at')
      .eq('user_id', uid)
      .single();

    const plan = subData?.plan || 'free';

    if (plan !== 'free' && subData?.expires_at) {
      const now = new Date();
      const expireDate = new Date(subData.expires_at);
      
      if (now > expireDate) {
        await supabaseServiceRole
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

    if (plan === 'free') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count, error: countErr } = await supabaseServiceRole
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

    // ✅ Record print with service role
    const { data, error } = await supabaseServiceRole
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

// Validate worksheet key
app.post('/api/validate-worksheet-key', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { license_key } = req.body;

    if (!license_key) {
      return res.status(400).json({ error: 'Missing license key' });
    }

    console.log('🔍 [validate-worksheet-key]', { uid, license_key });

    // ✅ CHECK duplicate with service role (need to see all keys)
    const { data: existingKey } = await supabaseServiceRole
      .from('license_key_tracking')
      .select('*')
      .eq('license_key', license_key)
      .maybeSingle();
    
    if (existingKey) {
      console.log('⚠️ Key already used');
      return res.status(400).json({
        error: '❌ This license key has already been used. Please purchase a new key.',
      });
    }

    // Verify with Gumroad (optional)
    try {
      const gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GUMROAD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: 'ZVD-qJaKJoXuQcyDT2c2zQ==',
          license_key: license_key
        })
      });
      
      const gumroadData = await gumroadRes.json();
      if (!gumroadData.success) {
        return res.status(400).json({
          error: '❌ ' + (gumroadData.message || 'Invalid license key')
        });
      }
    } catch (gumroadErr) {
      console.warn('⚠️ Gumroad API error:', gumroadErr.message);
    }

    // ✅ Activate with service role
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 40);

    const { data: trackingData, error: trackingError } = await supabaseServiceRole
      .from('license_key_tracking')
      .insert([
        {
          product_id: 'worksheet_builder_print',
          license_key: license_key,
          user_id: uid,
          plan: 'plan_pro',
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }
      ])
      .select();

    if (trackingError) {
      console.error('❌ Failed to track license key:', trackingError);
      return res.status(400).json({
        error: '❌ Failed to activate license. Please try again.'
      });
    }

    const { data: subData, error: subError } = await supabaseServiceRole
      .from('worksheet_subscriptions')
      .upsert([
        {
          user_id: uid,
          plan: 'plan_pro',
          license_key: license_key,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id' })
      .select();

    if (subError) {
      console.error('❌ Failed to update subscription:', subError);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    console.log('✅ Worksheet subscription activated');

    res.json({
      success: true,
      plan: 'plan_pro',
      message: '✅ Worksheet Pro activated for 40 days',
      expiresAt: expiresAt.toISOString(),
      data: subData[0]
    });

  } catch (error) {
    console.error('❌ [validate-worksheet-key] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate subscription key
app.post('/api/validate-subscription-key', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { license_key, product_id } = req.body;
    
    if (!license_key || !product_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('🔍 [validate-subscription-key]', { uid, license_key, product_id });
    
    const productToPlanMap = {
      '_DYSbAhcnplnuvbITAaS4w==': 'plan_a',
      'uDJUEtaZDQO6RMx2NKnUHQ==': 'plan_b',
      '37sC-ZSp7TXkVHJGkOdJgg==': 'plan_c',
    };
    
    const plan = productToPlanMap[product_id];
    
    if (!plan) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    // ✅ CHECK duplicate with service role
    const { data: existingKey } = await supabaseServiceRole
      .from('license_key_tracking')
      .select('*')
      .eq('license_key', license_key)
      .eq('product_id', product_id)
      .maybeSingle();
    
    if (existingKey) {
      console.log('⚠️ Key already used');
      return res.status(400).json({
        error: '❌ This license key has already been used. Please purchase a new key.',
      });
    }
    
    // Verify with Gumroad
    console.log('🔐 Verifying key with Gumroad API...');
    
    try {
      const gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GUMROAD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: product_id,
          license_key: license_key
        })
      });
      
      const gumroadData = await gumroadRes.json();
      
      console.log('📡 Gumroad Response:', {
        status: gumroadRes.status,
        success: gumroadData.success
      });
      
      if (!gumroadData.success) {
        console.error('❌ Gumroad validation failed:', gumroadData.message);
        return res.status(400).json({
          error: '❌ ' + (gumroadData.message || 'Invalid license key')
        });
      }
      
      console.log('✅ Gumroad validation passed');
      
    } catch (gumroadErr) {
      console.warn('⚠️ Gumroad API error:', gumroadErr.message);
    }
    
    // ✅ Activate with service role
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 40);
    
    console.log('💾 Activating subscription...');
    
    const { data: trackingData, error: trackingError } = await supabaseServiceRole
      .from('license_key_tracking')
      .insert([
        {
          product_id: product_id,
          license_key: license_key,
          user_id: uid,
          plan: plan,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }
      ])
      .select();
    
    if (trackingError) {
      console.error('❌ Failed to track license key:', trackingError);
      return res.status(400).json({
        error: '❌ Failed to activate license. Please try again.'
      });
    }
    
    const { data: subData, error: subError } = await supabaseServiceRole
      .from('user_subscriptions')
      .upsert([
        {
          user_id: uid,
          plan: plan,
          product_id: product_id,
          license_key: license_key,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id' })
      .select();
    
    if (subError) {
      console.error('❌ Failed to update subscription:', subError);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }
    
    console.log('✅ Subscription activated successfully');
    
    const planDisplayName = plan.replace('plan_', '').toUpperCase();
    
    res.json({
      success: true,
      plan: plan,
      product_id: product_id,
      message: `✅ ${planDisplayName} subscription activated for 40 days`,
      expiresAt: expiresAt.toISOString(),
      data: subData[0]
    });
    
  } catch (error) {
    console.error('❌ [validate-subscription-key] Error:', error);
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
  console.log(`   RLS: Enabled`);
});
