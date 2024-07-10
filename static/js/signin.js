document.getElementById('signinForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    const response = await fetch('/signin/', {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if (response.ok) {
        // Успешный вход
        window.location.href = data.redirect_url;
        console.log(data);
    } else {
        // Ошибка входа
        const errorModal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = data.error;
        errorModal.style.display = 'block';

        // Обработчик закрытия модального окна
        const closeButton = document.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            errorModal.style.display = 'none';
        });
    }
});