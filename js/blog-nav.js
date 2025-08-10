(() => {
  // Dữ liệu JSON bài viết
  const posts = [
    {
      "id": 1,
      "title": "Learn Chinese Online with Chinese60s",
      "category": "learning-tips",
      "thumbnail": "",
      "videoLink": "",
      "htmlLink": "https://chinese60s.com/blog/blog-1"
    },
    {
      "id": 2,
      "title": "What Should You Do When Starting to Learn Chinese?",
      "category": "learning-tips",
      "thumbnail": "",
      "videoLink": "",
      "htmlLink": "https://chinese60s.com/blog/blog-2"
    },
    {
      "id": 3,
      "title": "The True Nature of Learning Chinese: What Makes It Unique",
      "category": "learning-tips",
      "thumbnail": "",
      "videoLink": "",
      "htmlLink": "https://chinese60s.com/blog/blog-3"
    },
    {
      "id": 4,
      "title": "How to Keep Learning Chinese When You’re Really Busy",
      "category": "learning-tips",
      "thumbnail": "",
      "videoLink": "",
      "htmlLink": "https://chinese60s.com/blog/blog-4"
    },
    {
      "id": 5,
      "title": "How to Effectively Learn New Chinese Vocabulary",
      "category": "learning-tips",
      "thumbnail": "",
      "videoLink": "",
      "htmlLink": "https://chinese60s.com/blog/blog-5"
    },
    {
      "id": 6,
      "title": "[Real-Life Chinese] 九十后租房 - House hunting as a post-90s renter - Douyin Script",
      "category": "real-chinese",
      "thumbnail": "",
      "videoLink": "",
      "htmlLink": "https://chinese60s.com/blog/blog-6"
    }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    // Lấy phần cuối URL hiện tại, ví dụ 'blog-3'
    const currentUrl = window.location.href.split('/').pop();

    // Tìm bài hiện tại theo htmlLink kết thúc bằng currentUrl
    const currentPost = posts.find(p => p.htmlLink.endsWith(currentUrl));

    if (!currentPost) {
      console.warn('Không tìm thấy bài hiện tại trong danh sách posts');
      return;
    }

    const currentId = currentPost.id;

    // Tìm bài trước (id nhỏ hơn)
    const prevPost = posts.find(p => p.id === currentId - 1);
    if (prevPost && document.getElementById('prev-post')) {
      document.getElementById('prev-post').innerHTML = `<a href="${prevPost.htmlLink}">← ${prevPost.title}</a>`;
    } else if (document.getElementById('prev-post')) {
      document.getElementById('prev-post').textContent = '← No previous post';
    }

    // Tìm bài tiếp theo (id lớn hơn)
    const nextPost = posts.find(p => p.id === currentId + 1);
    if (nextPost && document.getElementById('next-post')) {
      document.getElementById('next-post').innerHTML = `<a href="${nextPost.htmlLink}">${nextPost.title} →</a>`;
    } else if (document.getElementById('next-post')) {
      document.getElementById('next-post').textContent = 'No next post →';
    }

    // Hiển thị 5 bài mới nhất (theo id giảm dần)
    const latestList = document.getElementById('latest-list');
    if (latestList) {
      const sortedPosts = posts.slice().sort((a, b) => b.id - a.id);
      sortedPosts.slice(0, 5).forEach(post => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${post.htmlLink}">${post.title}</a>`;
        latestList.appendChild(li);
      });
    }
  });
})();
