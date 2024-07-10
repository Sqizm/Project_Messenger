let userId;

// Получение данных авторизованного пользователя
async function fetchCustomUser() {
    try {
        const response = await fetch('/customuser/');
        const data = await response.json();

        // Получение данных
        const username = data.username;
        const avatarUrl = data.avatar;
        userId = data.id;

        // Обновление элементов HTML
        document.getElementById('username').textContent = username;
        document.getElementById('avatar').src = avatarUrl;
    } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error);
    }
}

fetchCustomUser(); // Вызов

const usernameElement = document.getElementById('username');
usernameElement.addEventListener('click', showUpdateUserModal);

function showUpdateUserModal() {
    const modal = document.getElementById("updateUserModal");
    modal.style.display = "block";

    // Заполняем поле модального окна текущими данными
    document.getElementById("UserNameInput").value = usernameElement.textContent;

    // Сохраняем userId, чтобы использовать его при обновлении данных
    modal.dataset.userId = userId;

    // Добавляем обработчики событий на модальное окно
    const closeButton = document.getElementsByClassName("close-button")[0];
    closeButton.addEventListener("click", () => closeUpdateUserModal(modal));

    modal.addEventListener("click", (event) => {
        if (event.target == modal) {
            closeUpdateUserModal(modal);
        }
    });
}

const updateUserSubmitButton = document.getElementById("updateUserSubmit");
updateUserSubmitButton.addEventListener("click", updateUserData);

async function updateUserData() {
    try {
        const newUsername = document.getElementById("UserNameInput").value;
//        const newAvatarFile = document.getElementById("UserAvatarInput").files[0] : await createTempFile(await getDefaultAvatar());
        let newAvatarFile;

        // Проверяем, выбрал ли пользователь новый аватар
        if (document.getElementById("UserAvatarInput").files.length > 0) {
            newAvatarFile = document.getElementById("UserAvatarInput").files[0];
        } else {
            // Если нет, получаем дефолтный аватар и создаем временный файл
            const defaultAvatar = await getDefaultAvatar();
            newAvatarFile = await createTempFile(defaultAvatar);
        }

        const userId = document.getElementById("updateUserModal").dataset.userId;

        // Создаем формдата для отправки данных на сервер
        const formData = new FormData();
        formData.append("username", newUsername);
        formData.append("avatar", newAvatarFile);

        const csrftoken = getCookie('csrftoken');
        const response = await fetch(`/customuser/${userId}/`, {
            method: "PUT",
            headers: {
                'X-CSRFToken': csrftoken,
                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
            },
            body: formData
        });

        if (response.ok) {
        const data = await response.json();

        // Обновляем отображение на странице
        usernameElement.textContent = data.username;
        document.getElementById("avatar").src = data.avatar;

        // Закрываем модальное окно
        closeUpdateUserModal();
        } else {
            console.error("Ошибка при обновлении данных пользователя:", response.status);
        }
    } catch (error) {
        console.error("Ошибка при обновлении данных пользователя:", error);
    }
}

//const closeButton = document.getElementsByClassName("close-button")[0];
//closeButton.addEventListener("click", closeUpdateUserModal);
//
//
//modal.addEventListener("click", (event) => {
//    if (event.target == modal) {
//        closeUpdateUserModal();
//    }
//});

function closeUpdateUserModal(modal) {
    modal.style.display = "none";
}

// Функция получения токена для HTTP-запросов, которые требуют CSRF-токен.
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Проверяем, начинается ли cookie с нужным именем
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Функция для отправки аватар при обновлении
async function getDefaultAvatar() {
    const response = await fetch('/media/def_avatar.png');
    return await response.blob();
}

async function createTempFile(blob) {
    return new File([blob], 'def_avatar.png', { type: 'image/png' });
}