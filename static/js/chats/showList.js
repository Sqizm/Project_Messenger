let currentSocket = null;

// Функция показа списка групповых чатов
const fetchChats = async () => {
    try {
        const response = await fetch('/chat/');
        const data = await response.json();
        console.log(data);
        const chatList = document.getElementById('chat-list');

        // Выводим список чатов.
        data.forEach(chat => { // Можно использовать стандартный цикл for.
            const listItem = document.createElement('li');
            listItem.style.listStyleType = 'none'; // Убираем маркер
            const chatContainer = document.createElement('div');
            chatContainer.dataset.chatId = chat.id;
            chatContainer.classList.add('chat-list');
            const chatAvatar = document.createElement('img');
            chatAvatar.src = chat.avatar;
            chatAvatar.alt = `${chat.name} avatar`;
            chatAvatar.classList.add('avatar');
            const chatName = document.createElement('span');
            chatName.textContent = chat.name;
            chatName.classList.add('chat-name');
            chatContainer.appendChild(chatAvatar);
            chatContainer.appendChild(chatName);
            listItem.appendChild(chatContainer);
            chatList.appendChild(listItem);

            // Кнопка для удаления чата.
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'X';
            deleteButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                try {
                    const csrftoken = getCookie('csrftoken');
                    const chatId = chatContainer.dataset.chatId; // Получаем ID чата при клике на кнопку
                    const response = await fetch(`/chat/${chatId}/`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                            'Authorization': 'Bearer ' + localStorage.getItem('access_token')
                        }
                    });
                    if (response.ok) {
                        listItem.remove();
                    } else if (response.status === 403) {
                        const data = await response.json();
                        alert(`Ошибка: ${data.error}`);
                    } else {
                        const data = await response.json();
                        console.log('Ошибка при удалении чата: ', data);
                    }
                } catch (error) {
                    console.log('Ошибка: ', error);
                }
            });
            chatContainer.appendChild(deleteButton);

            // Кнопка для обнавления чата.
            const updateChatButton = document.createElement('button');
            updateChatButton.textContent = 'U';
            const updateChatModal = document.getElementById('updateChatModal');
            const closeButton = document.getElementsByClassName('close-button')[0];
            const updateChatSubmit = document.getElementById('updateChatSubmit');
            const chatNameInput = document.getElementById('chatNameInput');
            const chatAvatarInput = document.getElementById('chatAvatarInput');

            updateChatButton.addEventListener('click', async () => {
                updateChatModal.style.display = 'block';
            });

            closeButton.addEventListener('click', async () => {
                updateChatModal.style.display = 'none';
            });

            window.addEventListener('click', async (event) => {
                if (event.target == updateChatModal) {
                    updateChatModal.style.display = 'none';
                }
            });

            updateChatButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                const csrftoken = getCookie('csrftoken');
                const chatId = chatContainer.dataset.chatId; // Получаем ID чата при клике на кнопку
                updateChatSubmit.addEventListener('click', async () => {
                    const newTitle = chatNameInput.value;
                    const newAvatar = chatAvatarInput.files.length > 0 ? chatAvatarInput.files[0] : await createTempFile(await getDefaultAvatar());

                    const formData = new FormData();
                    formData.append('name', newTitle);
                    formData.append('avatar', newAvatar);

                    try {
                        const response = await fetch(`/chat/${chatId}/`, {
                            method: 'PUT',
                            headers: {
                                'X-CSRFToken': csrftoken,
                                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
                            },
                            body: formData
                        });

                        if (response.ok) {
                            updateChatModal.style.display = 'none';
                            listItem.update();
                        } else if (response.status === 403) {
                            const data = await response.json();
                            alert(`Ошибка: ${data.error}`);
                        } else {
                            console.error('Произошла ошибка при обновлении чата');
                        }
                    } catch(error) {
                        console.error('Ошибка:', error);
                    }
                });
            });
            chatContainer.appendChild(updateChatButton);

            // Добавление обработчика события клика. Делаем чаты в списке кликабельными с переходом на переписку.
            chatContainer.addEventListener('click', () => {
                // Подключение к веб-сокету с использованием chat_id, получаем при клике.
                const chat_id = chatContainer.dataset.chatId;
                const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${chat_id}/`);

                // Сохранить ссылку на веб-сокет-соединение в элементе чата
                chatContainer.dataset.socket = socket;

                // Сохранить текущее веб-сокет-соединение в глобальную переменную
                currentSocket = socket;

                // Сохранить идентификатор чата в веб-сокет-соединении
                currentSocket.chatId = chat_id;

                // Очистка приветственного сообщения
                const welcomeMessageContainer = document.getElementById('message-container');
                welcomeMessageContainer.innerHTML = '';

                // Приветственное сообщение.
                const firstMessageDiv = document.createElement('div');

                const chatName = document.createElement('strong');
                chatName.textContent = chat.name + ': ';

                const creatorName = document.createElement('p');
                creatorName.textContent = `Добро пожаловать в чат! Создатель этого чата: ${chat.creator_username}`;

                firstMessageDiv.appendChild(chatName);
                firstMessageDiv.appendChild(creatorName);
                welcomeMessageContainer.appendChild(firstMessageDiv);

                // Очистка существующих обработчиков onmessage
                if (currentSocket.onmessage) {
                    currentSocket.removeEventListener('message', currentSocket.onmessage);
                }

                // Установка обработчика сообщения от сервера
                currentSocket.onmessage = (event) => {
                    const { message, chatId, participant } = JSON.parse(event.data);
                    console.log(`Received message: ${message} for chatId: ${chatId}`);

                    // Здесь вы можете добавить код для отображения сообщения на странице
                    const chatMessagesContainer = document.getElementById('message-container');

                    const newMessageContainer = document.createElement('div');
                    newMessageContainer.classList.add('message-container');

                    const userParticipant = document.createElement('strong');
                    userParticipant.textContent = participant.username + ': ';

                    const userMessage = document.createElement('p');
                    userMessage.textContent = message;

                    newMessageContainer.appendChild(userParticipant);
                    newMessageContainer.appendChild(userMessage);

                    chatMessagesContainer.appendChild(newMessageContainer);
                };
            });
        });
    } catch (error) {
        console.log('Ошибка: ', error);
    }
};
fetchChats(); // Вызов

// Обработка сообщений в групповых чатов.
document.getElementById('message-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const messageInput = document.getElementById('message-input').value;

    // Использовать сохраненное веб-сокет-соединение
    if (currentSocket) {
        const payload = {
            'message': messageInput,
            'chatId': currentSocket.chatId,
        };
        console.log('Sending payload:', payload);
        currentSocket.send(JSON.stringify(payload));
    } else {
        console.log('Активный элемент группового чата не найден! Перейдите в какой-либо чат!');
    }
});

// Функция показа списка пользователей в sidebar'е
const getUser = async () => {
    try {
        const response = await fetch('/users/');
        const data = await response.json();
        console.log(data);
        const userList = document.getElementById('user-list');
        data.forEach(user => { // Список пользователей
            const listItem = document.createElement('li');
            listItem.style.listStyleType = 'none';
            const userContainer = document.createElement('div');
            userContainer.dataset.userId = user.id;
            userContainer.classList.add('user-list');
            const userAvatar = document.createElement('img');
            userAvatar.src = user.avatar;
            userAvatar.alt = `${user.username} avatar`;
            userAvatar.classList.add('avatar');
            const userName = document.createElement('span');
            userName.textContent = user.username;
            userName.classList.add('user-name');
            userContainer.appendChild(userAvatar);
            userContainer.appendChild(userName);
            listItem.appendChild(userContainer);
            userList.appendChild(listItem);

            // Добавление обработчика события клика. Делаем пользователей в списке кликабельными с переходом на переписку.
            userContainer.addEventListener('click', (event) => {
                // Подключение к WebSocket-каналу
                connectToWebSocketChannel(currentUserId, user.id);
            });
        });
    } catch (error) {
        console.log('Ошибка: ', error);
    }
}

// Функция установки соединения между пользователями, отправки и получения сообщений.
const connectToWebSocketChannel = (user1Id, user2Id) => {
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/customuser/${user1Id}/${user2Id}/`);

    // Отправляем сообщение
    socket.onopen = () => {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');

        sendButton.addEventListener('click', () => {
            const message = messageInput.value;
            socket.send(JSON.stringify({ message, sender_id: user1Id, receiver_id: user2Id }));
            messageInput.value = '';
        });
    };

    // Отображаем полученное сообщение
    socket.onmessage = async event => {
        const { message, sender_id, receiver_id } = JSON.parse(event.data);
        console.log(`Received message: ${message} for chatId: ${sender_id}`);

        const chatMessagesContainer = document.getElementById('message-container');

        const newMessageContainer = document.createElement('div');
        newMessageContainer.classList.add('message-container');

        const senderUser = await fetchUserById(sender_id); // Получаю username пользователя.
        const receiverUser = await fetchUserById(receiver_id);

        const userParticipant = document.createElement('strong');
        userParticipant.textContent = `${senderUser.username}: `; // Вывожу username пользователя.

        const userMessage = document.createElement('p');
        userMessage.textContent = message;

        newMessageContainer.appendChild(userParticipant);
        newMessageContainer.appendChild(userMessage);

        chatMessagesContainer.appendChild(newMessageContainer);
  };
};

// Функция получения данных пользователя.
const fetchUserById = async (userId) => {
    try {
        const response = await fetch(`/customuser/${userId}/`);
        return await response.json();
    } catch (error) {
        console.log('Ошибка: ', error);
        return null;
    }
};

getUser(); // Вызов функции списка пользователей.

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

// Функция для отправки аватара при редактировании
async function getDefaultAvatar() {
    const response = await fetch('/media/def_channel.png');
    return await response.blob();
}

async function createTempFile(blob) {
    return new File([blob], 'def_channel.png', { type: 'image/png' });
}