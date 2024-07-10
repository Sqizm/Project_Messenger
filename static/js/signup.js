document.getElementById('signupForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(this);
    const response = await fetch('/signup/', {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    console.log(data);
});