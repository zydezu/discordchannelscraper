const messageTemplate = `
    <div class="message">
        <img src="{{PFP}}" class="avatar" alt="{{DISPLAYNAME}} Avatar">
        <div class="message-content">
            <div class="user-area">
                <span class="username" style="color:{{ROLECOLOR}};">{{DISPLAYNAME}}</span>
                <span class="timestamp">{{TIMESTAMP}}</span>
            </div>
            <div class="message-text">{{MESSAGE}}</div>
            {{MEDIA}}
        </div>
    </div>
`;

const imageDiv = `<img src="{{IMAGEURL}}" class="image {{EXTRACLASSES}}" alt="{{IMAGEALT}}">`
const videoDiv = `<video controls src="{{VIDEOURL}}" class="image {{EXTRACLASSES}}" alt="{{VIDEOALT}}"></video>`

const discordBox = document.getElementById("discordBox");
const selectedFile = document.getElementById("selectedFile");

const dropZone = document.querySelector("body");

window.addEventListener("dragover", (e) => {
    e.preventDefault();
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("getFile");
    read(e.dataTransfer.files);
});

function openFile() {
    document.getElementById("getFile").click();
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        let fr = new FileReader();
        fr.onload = (x) => resolve(fr.result);
        try {
            fr.readAsText(file);
        } catch (error) {
            console.log("Invalid file type!");
        }
    });
}

async function read(input) {
    fileType = "";
    if (input.files) {
        data = await readFile(input.files[0]);
        selectedFile.innerHTML = input.files[0].name;
        fileType = input.files[0].type;
    } else {
        data = await readFile(input[0]);
        selectedFile.innerHTML = input[0].name;
        fileType = input[0].type;
    }
    if (fileType != "application/json") return;

    data = JSON.parse(data);
    renderMessages(data);
}

function makeLinks(content) {
    var re =
        /((?:href|src)=")?(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    content = content.replace(re, function (match, attr) {
        if (typeof attr != "undefined") {
            return match;
        }
        return '<a target="_blank" href="' + match + '">' + match + "</a>";
    });
    return content;
}

function getTenorSlug(tenorViewUrl) {
    const slug = tenorViewUrl.replace(/\/$/, '').split('/').pop();
    return `gifs/${encodeURIComponent(slug)}.gif`;
}

function formatText(text) {
    text = text.replace(/\\\*/g, '*');
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
    return text;
}

async function renderMessages(data) {
    let startTime = performance.now();
    discordBox.innerHTML = "Rendering messages...";

    const fragment = document.createDocumentFragment();

    const guildInfo = data.guild;
    const channelInfo = data.channel;
    const messages = data.messages;

    discordBox.innerHTML = `
        <hr>
        <b>${guildInfo.name}</b><br>
        ${channelInfo.name} - ${channelInfo.topic}<br>
        <hr>
    `

    for (const message of messages) { // 🔹 change to for...of so we can use await inside
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");

        const formattedDate = new Date(`${message.timestamp}`).toLocaleString("en-GB", { dateStyle: 'short', timeStyle: 'short' });
        const roleColor = message.author.color;

        const messageContent = message.reference ? "Forwarded message" : message.content;
        const attachments = message.attachments;

        let attachmentsString = '';
        attachments.forEach(media => {
            const fileName = media.fileName.toLowerCase();

            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
            const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
            const videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'];

            const extension = fileName.split('.').pop();

            let fileType;
            if (imageExtensions.includes(extension)) {
                fileType = 'image';
            } else if (audioExtensions.includes(extension)) {
                fileType = 'audio';
            } else if (videoExtensions.includes(extension)) {
                fileType = 'video';
            } else {
                fileType = 'unknown';
            }

            const isOnlyMedia = messageContent === "";

            if (fileType == 'image') {
                attachmentsString += imageDiv
                    .replace("{{IMAGEURL}}", media.url)
                    .replace("{{IMAGEALT}}", fileName)
                    .replace("{{EXTRACLASSES}}", isOnlyMedia ? 'image-only' : '');
            } else if (fileType == 'video') {
                attachmentsString += videoDiv
                    .replace("{{VIDEOURL}}", media.url)
                    .replace("{{VIDEOALT}}", fileName)
                    .replace("{{EXTRACLASSES}}", isOnlyMedia ? 'image-only' : '');
            }
        });

        const tenorRegex = /https?:\/\/tenor\.com\/view\/[^\s]+/i;
        const tenorMatch = messageContent.match(tenorRegex);

        if (tenorMatch) {
            try {
                const gifUrl = getTenorSlug(tenorMatch[0]);
                attachmentsString += imageDiv
                    .replace("{{IMAGEURL}}", gifUrl)
                    .replace("{{IMAGEALT}}", "Tenor GIF")
                    .replace("{{EXTRACLASSES}}", messageContent.trim() === tenorMatch[0] ? 'image-only' : '');
            } catch (err) {
                console.error("Failed to build Tenor GIF URL:", err);
            }
        }

        messageDiv.innerHTML = messageTemplate
            .replace("{{PFP}}", message.author.avatarUrl)
            .replaceAll("{{DISPLAYNAME}}", message.author.nickname)
            .replace("{{TIMESTAMP}}", formattedDate.replace(",", ''))
            .replace("{{MESSAGE}}", tenorMatch ? '' : formatText(makeLinks(messageContent)))
            .replace("{{ROLECOLOR}}", roleColor)
            .replace("{{MEDIA}}", attachmentsString);

        fragment.appendChild(messageDiv);
    }

    discordBox.appendChild(fragment);
    console.debug(`%cuserinfogenerate.js %c> %cGenerated messages in ${(performance.now() - startTime).toFixed(2)}ms`, "color:#ff52dc", "color:#fff", "color:#ffa3ed");
};