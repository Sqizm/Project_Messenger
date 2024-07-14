let currentSocket = null;
let currentSocketUser = null; // Для сохранения ссылки на текущее соединение при отправки сообщений между пользователями.
let currentSelectedUser = null; // Переменная для хранения текущего выбранного пользователя.
let userSockets = {};

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
                switchToChat(chat_id, chat);
            });
        });
    } catch (error) {
        console.log('Ошибка: ', error);
    }
};
fetchChats(); // Вызов

const messageForm = document.getElementById('message-form');

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (message) {
        if (currentSocketUser) {
            currentSocketUser.send(JSON.stringify({ type: 'chat_message', message, sender_id: currentUserId, receiver_id: currentSelectedUser, room_name: `chat_room_${currentUserId}_${currentSelectedUser}` }))
        } else if (userSockets[currentUserId]) {
            userSockets[currentUserId].send(JSON.stringify({ message, chatId: currentChatId }));
        } else {
            alert('Невозможно отправить сообщение, нет активного соединения.');
        }
        messageInput.value = '';
    } else {
        alert('Невозможно отправить пустое сообщение!');
    }
});

const connectToWebSocketChannelChats = (chat_id, chat) => {
    currentChatId = chat_id;
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${chat_id}/`);
    userSockets[currentUserId] = socket;

    socket.onerror = (event) => {
        console.log('WebSocket ошибка: ', event);
    };

    socket.onclose = () => {
        // Обнуляем текущее соединение, чтобы можно было открыть новое
        currentSocket = null;
        // Удаляем сокет из объекта userSockets
        userSockets[currentUserId];
    }

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

    // Отображаем полученное сообщение
    socket.onmessage = async event => {
        const data = JSON.parse(event.data);

        if (data.type === 'history') {
            const messageHistory = data.messages;
            const chatMessagesContainer = document.getElementById('message-container');
            messageHistory.forEach(message => {
                const newMessageContainer = document.createElement('div');
                newMessageContainer.classList.add('message-container');

                const userParticipant = document.createElement('strong');
                userParticipant.textContent = message.author.username + ': ';

                const userMessage = document.createElement('p');
                userMessage.textContent = message.text;

                newMessageContainer.appendChild(userParticipant);
                newMessageContainer.appendChild(userMessage);

                chatMessagesContainer.appendChild(newMessageContainer);
            });
        } else {
            const participant = data.participant
            const message = data.message
            const chatMessagesContainer = document.getElementById('message-container');

            if (chatMessagesContainer) {
                const newMessageContainer = document.createElement('div');
                newMessageContainer.classList.add('message-container');

                const userParticipant = document.createElement('strong');
                userParticipant.textContent = participant.username + ': ';

                const userMessage = document.createElement('p');
                userMessage.textContent = message;

                newMessageContainer.appendChild(userParticipant);
                newMessageContainer.appendChild(userMessage);

                chatMessagesContainer.appendChild(newMessageContainer);
            }
        }
    }

    window.addEventListener('beforeunload', () => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    });
    return socket;
};

function switchToChat(chat_id, participant, chat) {
    if (currentSocketUser) {
        // Закрываем текущее соединение с пользователем, если пользователь решил перейти в групповой чат.
        currentSocketUser.close();
    }

    if (userSockets[currentUserId]) {
        userSockets[currentUserId].close();
    }
    connectToWebSocketChannelChats(chat_id, participant, chat);
}

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
            userContainer.addEventListener('click', async (event) => {
                if (userSockets[currentUserId]) {
                    // Закрываем текущее соединение с чатом, если пользователь решил перейти к диалогу с другим пользователем.
                    userSockets[currentUserId].close();
                }

                if (currentSelectedUser === user.id) {
                    alert('Пользователь для диалога уже выбран! Начинай писать сообщения в форму!');
                    return;
                }

                if (currentSocketUser) {
                    // Закрываем текущее соединение, если оно есть
                    currentSocketUser.close();
                }

                // Устанавливаем нового выбранного пользователя
                currentSelectedUser = user.id;

                // Устанавливаем новое соединение с выбранным пользователем
                currentSocketUser = await connectToWebSocketChannel(currentUserId, user.id);
                fetchMessageHistory(currentSocketUser, currentUserId, user.id);
            });
        });
    } catch (error) {
        console.log('Ошибка: ', error);
    }
}

// Функция загрузки истории сообщений между двумя пользователями.
const fetchMessageHistory = (socket, user1Id, user2Id) => {
    const message = {
        action: 'fetch_message_history',
        user1_id: user1Id,
        user2_id: user2Id
    };

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    } else {
        socket.onopen = function () {
            socket.send(JSON.stringify(message));
        };
    }
};

// Функция установки соединения между пользователями, отправки и получения сообщений.
const connectToWebSocketChannel = async (user1Id, user2Id) => {
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/customuser/${user1Id}/${user2Id}/`);

    socket.onerror = (event) => {
        console.log('WebSocket ошибка: ', event);
    };

    socket.onclose = () => {
        // Обнуляем текущее соединение, чтобы можно было открыть новое
//        currentSocketUser = null;
//        currentSelectedUser = null;
    }

    // Отображаем полученное сообщение
    socket.onmessage = async event => {
        const data = JSON.parse(event.data);
        if (data.action === 'message_history') {
            const messageHistory = data.data;
            const chatMessagesContainer = document.getElementById('message-container');
            chatMessagesContainer.innerHTML = ''; // Очищаем контейнер перед загрузкой новых сообщений
            messageHistory.forEach(message => {
                const newMessageContainer = document.createElement('div');
                newMessageContainer.classList.add('message-container');
                const userParticipant = document.createElement('strong');
                userParticipant.textContent = `${message.author.username}: `;
                const userMessage = document.createElement('p');
                userMessage.textContent = message.text;
                newMessageContainer.appendChild(userParticipant);
                newMessageContainer.appendChild(userMessage);
                chatMessagesContainer.appendChild(newMessageContainer);
            });
        } else {
            const chatMessagesContainer = document.getElementById('message-container');
            const newMessageContainer = document.createElement('div');
            newMessageContainer.classList.add('message-container');

            const sender_id = data.sender_id;
            const receiver_id = data.receiver_id;
            const message = data.message;

            const senderUser = await fetchUserById(sender_id); // Получаю username пользователя.
            const receiverUser = await fetchUserById(receiver_id);

            const userParticipant = document.createElement('strong');
            userParticipant.textContent = `${senderUser.username}: `; // Вывожу username пользователя.

            const userMessage = document.createElement('p');
            userMessage.textContent = message;

            newMessageContainer.appendChild(userParticipant);
            newMessageContainer.appendChild(userMessage);

            chatMessagesContainer.appendChild(newMessageContainer);
        }
    };

    window.addEventListener('beforeunload', () => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    });
    return socket;
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