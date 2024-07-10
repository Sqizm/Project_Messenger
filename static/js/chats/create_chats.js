// Получаем элементы модального окна
const modal = document.getElementById("createChatModal");
const btn = document.getElementById("createChatButton");
const span = document.getElementsByClassName("close-button")[0];

// Открываем модальное окно при клике на кнопку
btn.onclick = function() {
  modal.style.display = "block";
};

// Закрываем модальное окно при клике на X
span.onclick = function() {
  modal.style.display = "none";
};

// Закрываем модальное окно при клике вне области модального окна
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

// Добавляем обработчик события submit для формы
document.getElementById('createChatForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  const formData = new FormData(this);
  const response = await fetch('/api/create_chat/', {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  console.log(data);
  modal.style.display = "none"; // Закрываем модальное окно после успешной отправки формы
});