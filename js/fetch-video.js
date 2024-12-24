// Chạy khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
    // Lấy ID từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = parseInt(urlParams.get("id")); // Lấy id từ URL

    if (!videoId) {
        console.error("No video ID found in URL.");
        return;
    }

    // Fetch dữ liệu từ file JSON
    fetch("../data/thumbnail.json")
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch video data.");
            }
            return response.json();
        })
        .then((data) => {
            // Tìm video tương ứng với ID
            const video = data.find((item) => item.id === videoId);

            if (!video) {
                console.error("Video not found for the given ID.");
                return;
            }

            // Cập nhật nội dung HTML
            document.getElementById("video-title").textContent = video.title;
            document.getElementById("video-description").textContent = video.description;
            document.getElementById("video-iframe").src = video.videoLink;
        })
        .catch((error) => {
            console.error("Error fetching or processing video data:", error);
        });
});
