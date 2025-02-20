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

    // Xử lý việc mở accordion khi click vào link anchor
    const hash = window.location.hash; 
    if (hash) {
        const targetAccordion = document.querySelector(hash);
        if (targetAccordion) {
            const content = targetAccordion.querySelector('.accordion-content');
            const header = targetAccordion.querySelector('.accordion-header');
            if (content) {
                // Mở accordion
                content.style.display = "block"; 
                const icon = header.querySelector('.toggle-icon');
                icon.textContent = "−"; // Cập nhật biểu tượng
                // Cuộn đến accordion
                targetAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
});
