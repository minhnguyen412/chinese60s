document.addEventListener("DOMContentLoaded", function () {
    const items = document.querySelectorAll(".accordion-item");

    items.forEach((item) => {
        const header = item.querySelector(".accordion-header");
        const content = item.querySelector(".accordion-content");
        const icon = item.querySelector(".toggle-icon");

        header.addEventListener("click", function () {
            const isActive = content.style.display === "block";

            // Ẩn tất cả nội dung trước khi mở mục mới
            document.querySelectorAll(".accordion-content").forEach((c) => c.style.display = "none");
            document.querySelectorAll(".toggle-icon").forEach((i) => i.textContent = "+");

            if (!isActive) {
                content.style.display = "block";
                icon.textContent = "−"; // Dấu trừ khi mở
            } else {
                content.style.display = "none";
                icon.textContent = "+"; // Dấu cộng khi đóng
            }
        });
    });
});
