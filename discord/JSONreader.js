const messageTemplate = `
    <div class="message">
        <img src="{{PFP}}" class="avatar" alt="{{DISPLAYNAME}} Avatar"
        onload="this.style.opacity=1" loading="lazy">
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

const imageDiv = `<img src="{{IMAGEURL}}" class="image {{EXTRACLASSES}}" alt="{{IMAGEALT}}"
                    onload="this.style.opacity=1" loading="lazy">`
const videoDiv = `<video controls src="{{VIDEOURL}}" class="image {{EXTRACLASSES}}" alt="{{VIDEOALT}}"></video>`

const discordBox = document.getElementById("discordBox");
const selectedFile = document.getElementById("selectedFile");
const dropZone = document.querySelector("body");

let data;
const mediaFiles = [];

window.addEventListener("dragover", e => e.preventDefault());

dropZone.addEventListener("drop", e => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;

    const file = files[0];
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type === "application/json" || name.endsWith(".json")) {
        handleJsonUpload(files);
    } 
    else if (type === "application/zip" || name.endsWith(".zip")) {
        handleMediaUpload(files);
    } 
    else {
        console.warn("Unsupported file type:", file.name);
    }
});

function openFile() {
    document.getElementById("getFile").click();
}

function openMediaFile() {
    document.getElementById("getMediaFile").click();
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;

        if (file.type === "application/json") {
            fr.readAsText(file);
        } else {
            fr.readAsArrayBuffer(file);
        }
    });
}

async function handleJsonUpload(input) {
    const file = input.files ? input.files[0] : input[0];
    if (!file || file.type !== "application/json") return;

    selectedFile.innerHTML = `<code>${file.name}</code>`;

    try {
        const text = await readFile(file);
        data = JSON.parse(text);
        renderMessages(data);
    } catch (err) {
        console.error("Error reading JSON:", err);
    }
}

async function handleMediaUpload(input) {
    const file = input.files ? input.files[0] : input[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    if (!(fileNameLower.endsWith(".zip") || file.type.toLowerCase().includes("zip"))) {
        console.warn("Not a ZIP file:", file.name, file.type);
        return;
    }

    selectedFile.innerHTML = `<code>${file.name}</code>`;

    try {
        const arrayBuffer = await readFile(file);
        const zip = await JSZip.loadAsync(arrayBuffer);

        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir) {
                const blob = await zipEntry.async("blob");
                mediaFiles.push({ name: filename, blob });
            }
        }

        console.debug(`%cDEBUG %c> %cZip file read!`, "color:#ff52dc", "color:#fff", "color:#ffa3ed");
        // renderMediaFiles(mediaFiles);
        if (data) renderMessages(data);
    } catch (err) {
        console.error("Error reading ZIP:", err);
    }
}

function renderMediaFiles(files) {
    const container = document.getElementById("discordBox");
    container.innerHTML = "";

    files.forEach(file => {
        const url = URL.createObjectURL(file.blob);
        const img = document.createElement("img");
        img.src = url;
        img.alt = file.name;
        img.style.maxWidth = "150px";
        img.style.margin = "5px";
        container.appendChild(img);
    });
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

            if (fileType === 'image') {
                const finalName = `${message.timestamp}-${media.fileName}`.replaceAll(':', '-');

                const matchedMedia = mediaFiles.find(m => m.name === finalName);
                let imageUrl = media.url; // fallback
                if (matchedMedia) {
                    imageUrl = URL.createObjectURL(matchedMedia.blob);
                } else {
                    console.debug(`%cDEBUG %c> %cFailed to find ${finalName} in zip file`, "color:#ff52dc", "color:#fff", "color:#ffa3ed");
                }

                attachmentsString += imageDiv
                    .replace("{{IMAGEURL}}", imageUrl)
                    .replace("{{IMAGEALT}}", finalName)
                    .replace("{{EXTRACLASSES}}", isOnlyMedia ? 'image-only' : '');

            } else if (fileType === 'video') {
                const finalName = `${message.timestamp}-${media.fileName}`.replaceAll(':', '-');

                const matchedMedia = mediaFiles.find(m => m.name === finalName);
                let videoUrl = media.url; // fallback
                if (matchedMedia) {
                    videoUrl = URL.createObjectURL(matchedMedia.blob);
                } else {
                    console.debug(`%cDEBUG %c> %cFailed to find ${finalName} in zip file`, "color:#ff52dc", "color:#fff", "color:#ffa3ed");
                }

                attachmentsString += videoDiv
                    .replace("{{VIDEOURL}}", videoUrl)
                    .replace("{{VIDEOALT}}", finalName)
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
    console.debug(`%cDEBUG %c> %cGenerated messages in ${(performance.now() - startTime).toFixed(2)}ms`, "color:#ff52dc", "color:#fff", "color:#ffa3ed");
};