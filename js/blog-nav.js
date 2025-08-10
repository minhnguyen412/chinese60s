document.addEventListener('DOMContentLoaded', function() {
  fetch('../data/blog.json')  // sửa đường dẫn JSON cho đúng
    .then(response => response.json())
    .then(posts => {
      // Lấy file hiện tại, ví dụ: blog-3 (không có .html)
      let currentUrl = window.location.pathname.split('/').pop(); 

      // Tìm bài viết hiện tại dựa vào htmlLink có chứa currentUrl
      let currentPost = posts.find(p => p.htmlLink.includes(currentUrl));

      if (!currentPost) {
        console.warn('Không tìm thấy bài viết hiện tại trong JSON.');
        return;
      }

      let currentId = currentPost.id;

      // Sắp xếp bài viết giảm dần theo id để lấy 5 bài mới nhất
      let sortedPosts = posts.slice().sort((a, b) => b.id - a.id);

      // Bài trước: id nhỏ hơn currentId nhất
      let prevPost = posts
        .filter(p => p.id < currentId)
        .sort((a, b) => b.id - a.id)[0]; // lấy id nhỏ hơn gần nhất

      // Bài sau: id lớn hơn currentId nhất
      let nextPost = posts
        .filter(p => p.id > currentId)
        .sort((a, b) => a.id - b.id)[0]; // lấy id lớn hơn gần nhất

      // Hiển thị previous post
      if (prevPost && document.getElementById('prev-post')) {
        document.getElementById('prev-post').innerHTML = 
          `<a href="${prevPost.htmlLink}">← ${prevPost.title}</a>`;
      }

      // Hiển thị next post
      if (nextPost && document.getElementById('next-post')) {
        document.getElementById('next-post').innerHTML = 
          `<a href="${nextPost.htmlLink}">${nextPost.title} →</a>`;
      }

      // Hiển thị 5 bài mới nhất
      let latestList = document.getElementById('latest-list');
      if (latestList) {
        latestList.innerHTML = ''; // xóa nội dung cũ nếu có
        sortedPosts.slice(0, 5).forEach(post => {
          const li = document.createElement('li');
          li.innerHTML = `<a href="${post.htmlLink}">${post.title}</a>`;
          latestList.appendChild(li);
        });
      }
    })
    .catch(error => {
      console.error('Lỗi khi load blog.json:', error);
    });
});
