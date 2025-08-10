document.addEventListener('DOMContentLoaded', function() {
  fetch('../data/blog.json')
    .then(res => res.json())
    .then(posts => {
      let currentUrl = window.location.pathname.split('/').pop();
      let currentPost = posts.find(p => p.htmlLink.split('/').pop() === currentUrl);

      if (!currentPost) {
        console.warn('Không tìm thấy bài hiện tại trong blog.json');
        return;
      }

      let currentId = currentPost.id;
      let sortedPosts = [...posts].sort((a, b) => b.id - a.id);

      // Previous post
      let prevPost = posts.find(p => p.id === currentId - 1);
      if (prevPost) {
        document.getElementById('prev-post').innerHTML =
          `<a href="${prevPost.htmlLink}">← ${prevPost.title}</a>`;
      } else {
        document.getElementById('prev-post').innerHTML = '';
      }

      // Next post
      let nextPost = posts.find(p => p.id === currentId + 1);
      if (nextPost) {
        document.getElementById('next-post').innerHTML =
          `<a href="${nextPost.htmlLink}">${nextPost.title} →</a>`;
      } else {
        document.getElementById('next-post').innerHTML = '';
      }

      // Latest posts
      let latestList = document.getElementById('latest-list');
      if (latestList) {
        latestList.innerHTML = '';
        sortedPosts.slice(0, 5).forEach(post => {
          let li = document.createElement('li');
          li.innerHTML = `<a href="${post.htmlLink}">${post.title}</a>`;
          latestList.appendChild(li);
        });
      }
    })
    .catch(err => console.error('Error loading blog.json:', err));
});
