document.addEventListener('DOMContentLoaded', () => {
    // UI Tabs Logic
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    // Setup Time
    const now = new Date();
    document.getElementById('current-time-ui').innerText = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Chat Logic
    const chatContainer = document.getElementById('chat-container');
    const quickRepliesContainer = document.getElementById('quick-replies');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const scanningOverlay = document.getElementById('scanning-overlay');
    
    let chatHistoryLength = 0; // To track nodes for resetting
    
    // Store original nodes to reset
    const originalNodes = [];
    Array.from(chatContainer.childNodes).forEach(n => {
        if(n.nodeType === 1) originalNodes.push(n.cloneNode(true));
    });

    window.resetChat = () => {
        chatContainer.innerHTML = '';
        originalNodes.forEach(n => chatContainer.appendChild(n.cloneNode(true)));
        startScenario();
    };

    const scrollToBottom = () => { setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 50); };
    const getCurrentTime = () => { const n = new Date(); return `${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`; };

    const addMessage = (text, sender = 'agent', isHTML = false) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-wrapper ${sender}`;
        let content = isHTML ? text : `<div class="bubble">${text}</div>`;
        if (sender === 'user') {
            content = `<div class="bubble">${text}<div class="time">${getCurrentTime()}</div></div>`;
        } else {
            content += `<div class="time">${getCurrentTime()}</div>`;
        }
        msgDiv.innerHTML = content;
        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    };

    const showTypingIndicator = () => {
        const ind = document.createElement('div');
        ind.className = 'typing-indicator'; ind.id = 'typing-indicator';
        ind.innerHTML = '<span></span><span></span><span></span>';
        chatContainer.appendChild(ind); scrollToBottom();
    };

    const removeTypingIndicator = () => {
        const ind = document.getElementById('typing-indicator');
        if (ind) ind.remove();
    };

    const setQuickReplies = (replies) => {
        quickRepliesContainer.innerHTML = '';
        if (replies.length === 0) {
            quickRepliesContainer.style.display = 'none'; return;
        }
        quickRepliesContainer.style.display = 'flex';
        replies.forEach(reply => {
            const btn = document.createElement('button');
            btn.className = 'qr-btn';
            btn.innerText = reply.text;
            btn.onclick = () => { handleUserAction(reply.action, reply.text); };
            quickRepliesContainer.appendChild(btn);
        });
    };

    const simulateTyping = (cb, delay = 1000) => {
        setQuickReplies([]); showTypingIndicator();
        setTimeout(() => { removeTypingIndicator(); cb(); }, delay);
    };

    // Scenario State
    let step = 'START';
    let dwellTimer = null;

    const startScenario = () => {
        step = 'C0';
        simulateTyping(() => {
            // [C0] Onboarding
            addMessage("Chào bạn, mình là AI Support của Shopee. Mình có thể giúp bạn <b>Đổi trả, Hoàn tiền</b> hoặc <b>Kiểm tra tình trạng đơn</b>. <i>Lưu ý: Mình không thể can thiệp huỷ đơn đã xuất kho.</i> Bạn cần hỗ trợ gì ạ?", "agent", true);
            setQuickReplies([
                { text: "Đơn của tôi có vấn đề", action: "C1_VAGUE" },
                { text: "Tra cứu vận đơn", action: "OTHER" },
                { text: "Gặp nhân viên", action: "ESCALATE" }
            ]);
        });
    };

    const handleUserAction = (action, textOverride) => {
        const inputText = textOverride || chatInput.value.trim();
        if (inputText) {
            addMessage(inputText, 'user');
            chatInput.value = '';
        }

        const lowerText = inputText.toLowerCase();

        // [C7] Handling Failure & Recovery dynamically
        if(lowerText.includes("đơn này đang ở đâu") || lowerText.includes("hỏi vị trí")) {
            simulateTyping(() => {
                // AI misunderstands
                addMessage("Bạn muốn huỷ đơn hàng này đúng không ạ? (AI đang hiểu sai ý)", "agent", true);
                setQuickReplies([
                    { text: "Đúng, huỷ giúp tôi", action: "OTHER" },
                    { text: "Không phải ý này", action: "C7_RECOVERY" } // Explicit User Feedback for Recovery
                ]);
            });
            return;
        }

        // [C3] Handling Uncertainty dynamically
        if(lowerText.includes("chưa nhận được") && step === 'C5_FORM') {
            action = "C3_UNCERTAINTY";
        }

        switch(action) {
            case "C1_VAGUE":
                // [C1] AI Asks to clarify
                simulateTyping(() => {
                    addMessage("Dạ, đơn hàng của bạn đang bị <b>giao trễ, sai sản phẩm</b>, hay <b>hư hỏng</b> ạ? Vui lòng chọn bên dưới để mình hỗ trợ đúng nhất nhé. (Ask - Thu hẹp phạm vi)", "agent", true);
                    setQuickReplies([
                        { text: "Hàng bị hư hỏng", action: "C5_START" },
                        { text: "Giao trễ", action: "OTHER" }
                    ]);
                });
                break;

            case "C5_START":
                step = 'C5_WAIT_IMG';
                simulateTyping(() => {
                    addMessage("Rất tiếc vì sự cố hàng hư hỏng. Bạn vui lòng bấm nút <b>Camera</b> góc dưới bên trái để tải ảnh minh chứng lên nhé.");
                });
                break;

            case "UPLOAD_IMG":
                if (step !== 'C5_WAIT_IMG') { alert("Vui lòng tải ảnh ở bước được yêu cầu!"); return; }
                const imgHtml = `<div class="bubble"><i class="fa-solid fa-image"></i> Ảnh đính kèm<br><img src="https://via.placeholder.com/150/cccccc/666666?text=San+Pham+Vo" class="evidence-img"></div>`;
                addMessage(imgHtml, 'user', true);
                
                scanningOverlay.classList.add('active');
                document.getElementById('scan-progress').innerText = '100%';
                setTimeout(() => {
                    scanningOverlay.classList.remove('active');
                    showC5Form();
                }, 1500);
                break;

            case "C3_UNCERTAINTY":
                simulateTyping(() => {
                    // [C3] Don't Act
                    addMessage("Hệ thống ghi nhận đơn đã giao, nhưng bạn lại chưa nhận được. Vì thông tin mâu thuẫn, AI không thể tự duyệt hoàn tiền (Don't Act). Mình đã tạo Ticket #991 để nhân viên Shopee kiểm tra với Shipper. Bạn đợi 24h nhé.", "agent");
                    setQuickReplies([]);
                }, 1500);
                break;

            case "C7_RECOVERY":
                simulateTyping(() => {
                    addMessage("Xin lỗi bạn, mình đã hiểu nhầm. Mình sẽ kiểm tra lại vị trí đơn hàng của bạn ngay nhé. Hiện đơn đang ở trạm trung chuyển HN.", "agent");
                });
                break;

            case "CONFIRM":
                simulateTyping(() => {
                    document.querySelector('.app-container').classList.add('success-mode');
                    addMessage("Yêu cầu hoàn trả <b>150.000đ</b> đã được duyệt tự động. Tiền sẽ về ví trong 24h.", "agent", true);
                });
                break;

            case "ESCALATE":
                simulateTyping(() => {
                    addMessage("Mình đang kết nối bạn với Nhân viên. Vui lòng chờ giây lát...");
                });
                break;

            default:
                if (inputText) {
                    simulateTyping(() => {
                        addMessage("Xin lỗi, mình chưa nắm rõ ý bạn. Bạn có thể chọn các gợi ý bên dưới.");
                        setQuickReplies([{text: "Trở lại từ đầu", action: "START"}]);
                    });
                }
                break;
            case "START":
                resetChat();
                break;
        }
    };

    const showC5Form = () => {
        step = 'C5_FORM';
        simulateTyping(() => {
            const form = `
                <div class="bubble">
                    Dựa trên ảnh (Act), AI ghi nhận hàng vỡ. Vui lòng xác nhận thông tin hoàn tiền (Ask):
                    <div class="form-card">
                        <div class="form-group">
                            <label>Sản phẩm</label>
                            <input type="text" class="form-input" value="Cốc thuỷ tinh" readonly>
                        </div>
                        <div class="form-group">
                            <label>Số tiền đề xuất</label>
                            <input type="text" class="form-input" value="150.000đ">
                        </div>
                        <div class="warning-box">
                            <i class="fa-solid fa-circle-info"></i> Do giá trị < 5tr, AI được quyền tự động duyệt (Explainability).
                        </div>
                        <button class="btn btn-primary" onclick="window.submitAction('CONFIRM')">Xác nhận hoàn tiền</button>
                        <button class="btn btn-outline" onclick="window.submitAction('OTHER')">Kiểm tra lại</button>
                    </div>
                </div>
            `;
            addMessage(form, "agent", true);
        });
    };

    // Globals for onclick attributes
    window.submitAction = (action) => handleUserAction(action);
    
    sendBtn.addEventListener('click', () => handleUserAction());
    chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleUserAction(); });
    uploadBtn.addEventListener('click', () => handleUserAction('UPLOAD_IMG'));

    setTimeout(startScenario, 500);
});
