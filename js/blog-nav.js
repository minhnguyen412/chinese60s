document.addEventListener("DOMContentLoaded", function () {
    // Lấy tên file hiện tại
    const currentPage = window.location.pathname.split("/").pop();

    fetch("../data/blog.json") // Đường dẫn tới file JSON
        .then(response => response.json())
        .then(posts => {
            // Tìm index bài hiện tại
            const currentIndex = posts.findIndex(post => post.htmlLink.endsWith(currentPage));

            // Hiển thị Previous & Next
            const prevNextContainer = document.getElementById("prev-next");
            let html = "";

            if (currentIndex > 0) {
                html += `<a href="../${posts[currentIndex - 1].htmlLink}">⬅ Previous: ${posts[currentIndex - 1].title}</a>`;
            }

            if (currentIndex < posts.length - 1) {
                if (html) html += " | "; // Ngăn cách
                html += `<a href="../${posts[currentIndex + 1].htmlLink}">Next: ${posts[currentIndex + 1].title} ➡</a>`;
            }

            prevNextContainer.innerHTML = html || "<em>No more posts</em>";

            // Hiển thị 5 bài mới nhất
            const latestContainer = document.getElementById("latest-posts");
            posts
                .slice(-5) // Lấy 5 bài cuối
                .reverse() // Mới nhất trước
                .forEach(post => {
                    const li = document.createElement("li");
                    li.innerHTML = `<a href="../${post.htmlLink}">${post.title}</a>`;
                    latestContainer.appendChild(li);
                });
        })
        .catch(err => console.error("Error loading blog.json:", err));
});
