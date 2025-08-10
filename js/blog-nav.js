document.addEventListener('DOMContentLoaded', function() {
  fetch('../data/blog.json')
    .then(res => res.json())
    .then(posts => {
      // Lấy tên file hiện tại (VD: blog-3.html)
      let currentUrl = window.location.pathname.split('/').pop();
      let currentPost = posts.find(p => p.htmlLink.endsWith(currentUrl));

      if (!currentPost) return;

      let currentId = currentPost.id;

      // Sắp xếp bài theo id giảm dần để tìm latest posts
      let sortedPosts = [...posts].sort((a, b) => b.id - a.id);

      // Tìm previous post (id nhỏ hơn)
      let prevPost = posts.find(p => p.id === currentId - 1);
      if (prevPost) {
        document.getElementById('prev-post').innerHTML =
          `<a href="${prevPost.htmlLink}">← ${prevPost.title}</a>`;
      }

      // Tìm next post (id lớn hơn)
      let nextPost = posts.find(p => p.id === currentId + 1);
      if (nextPost) {
        document.getElementById('next-post').innerHTML =
          `<a href="${nextPost.htmlLink}">${nextPost.title} →</a>`;
      }

      // Hiển thị 5 bài mới nhất
      let latestList = document.getElementById('latest-list');
      sortedPosts.slice(0, 5).forEach(post => {
        let li = document.createElement('li');
        li.innerHTML = `<a href="${post.htmlLink}">${post.title}</a>`;
        latestList.appendChild(li);
      });
    })
    .catch(err => console.error('Error loading blog.json:', err));
});
