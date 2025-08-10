document.addEventListener("DOMContentLoaded", () => {
  const currentFile = window.location.pathname.split("/").pop(); // blog-3.html
  let currentId = null;

  fetch("../data/blog.json")
    .then(res => res.json())
    .then(posts => {
      // Tìm bài hiện tại
      const currentPost = posts.find(p => p.htmlLink.endsWith(currentFile));
      if (!currentPost) return;

      currentId = currentPost.id;

      // Previous post
      const prevPost = posts.find(p => p.id === currentId - 1);
      if (prevPost) {
        document.getElementById("prev-post").textContent = `← ${prevPost.title}`;
        document.getElementById("prev-post").href = `../${prevPost.htmlLink}`;
      } else {
        document.getElementById("prev-post").style.display = "none";
      }

      // Next post
      const nextPost = posts.find(p => p.id === currentId + 1);
      if (nextPost) {
        document.getElementById("next-post").textContent = `${nextPost.title} →`;
        document.getElementById("next-post").href = `../${nextPost.htmlLink}`;
      } else {
        document.getElementById("next-post").style.display = "none";
      }

      // Hiển thị 5 bài mới nhất
      const recentList = document.getElementById("recent-list");
      const latestFive = posts.slice(-5).reverse(); // 5 bài cuối, mới nhất
      latestFive.forEach(post => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="../${post.htmlLink}">${post.title}</a>`;
        recentList.appendChild(li);
      });
    })
    .catch(err => console.error("Lỗi tải blog.json:", err));
});
