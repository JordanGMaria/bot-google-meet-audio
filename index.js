import puppeteer from "puppeteer";
import fs from "fs";

let startAttempts = 0;

async function debugPage(page, label) {
    try {

        const url = page.url();
        const title = await page.title();

        console.log(`\n\n===== DEBUG ${label} =====`);
        console.log("URL:", url);
        console.log("TITLE:", title);

        console.log(`\n===== FIM =====\n\n`);

        return url;

    } catch (err) {

    }
}

function startAudioRecording() {

}

async function startNavegation(meetLink, browser) {

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log("START NAVEGATION:", meetLink);

    if (!browser) return;

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
    });

    await page.emulateTimezone("America/Sao_Paulo");

    page.on("framenavigated", frame => {
        if (frame === page.mainFrame()) {
            console.log("\n\n----NAVEGOU PARA:", frame.url(), "----\n\n");
        }
    });

    let recorder = null;

    try {
        await page.goto("https://myaccount.google.com", { waitUntil: "networkidle2" });

        const googleAccount = JSON.parse(process.env.google_bot);

        await wait(2500);

        if (!page.url().includes('myaccount.google.com')) {

            console.log("REALIZANDO AUTENTICAÇÃO GOOGLE");
            await page.goto('https://accounts.google.com');

            await wait(3700);

            const emailInput = await page.$('input[type="email"]');

            if (emailInput) {
                await page.evaluate(async () => {
                    console.log("\NTITULO PAGINA:", document.querySelector('title').innerText);
                });

                console.log("INPUT EMAIL ENCONTRADO...");
                await page.waitForSelector('input[type="email"]');

                await page.type('input[type="email"]', googleAccount.email, { delay: 180 });

                console.log("EMAIL DIGITADO...");

                await wait(3500);

                await page.evaluate(async () => {
                    const enterButtonOptions = ["next", "avançar"];

                    const buttons = [...document.querySelectorAll("button")];
                    const btn = buttons.find(el => {
                        const text = (el.innerText || "").toLowerCase().trim();
                        return enterButtonOptions.some(t => text.includes(t));
                    });

                    if (btn) btn.click();
                    else await page.keyboard.press('Enter');
                });

                await wait(3500);

                const pageTitle = await page.evaluate(async () => {
                    return document.querySelector('title').innerText;
                });

                const url = await debugPage(page, "after-email");

                const advancedPage = await page.$('input[type="password"]');
                if ((!advancedPage && !url.toString().match("pwd")) || (!pageTitle.toString().toLowerCase().match("welcome") && !pageTitle.toString().toLowerCase().match("olá")) && !url.toString().match("pwd")) {
                    console.log("NÃO AVANÇOU EM MUDAR DE PÁGINA", advancedPage);
                    await page.waitForSelector('input[type="email"]');
                    await page.type('input[type="email"]', googleAccount.email, { delay: 120 });
                    await page.keyboard.press('Enter');
                }

                const newValidationUrl = await debugPage(page, "after-email-new");
                if (newValidationUrl && !newValidationUrl.toString().match("pwd")) {
                    const html = await page.content();
                    console.log("\n----------");
                    console.log(html);
                    console.log("\n----------\n");
                    console.log("PROBLEMA EM AVANÇAR APÓS DIGITAR EMAIL");

                    return false;
                }

            } else {
                console.log("EMAIL NÃO ENCONTRADO...");
                await wait(3700);
                await page.waitForSelector(`div[data-email="${googleAccount.email}"]`);
                await page.click(`div[data-email="${googleAccount.email}"]`);
            }


            await wait(3500);

            const passwordInput = await page.$('input[type="password"]');

            if (passwordInput) {
                console.log("INPUT SENHA ENCONTRADA...");
                await page.type('input[type="password"]', googleAccount.password, { delay: 150 });
                await wait(3800);

                await page.evaluate(async () => {
                    const enterButtonOptions = ["next", "avançar"];

                    const buttons = [...document.querySelectorAll("button")];
                    const btn = buttons.find(el => {
                        const text = (el.innerText || "").toLowerCase().trim();
                        return enterButtonOptions.some(t => text.includes(t));
                    });

                    if (btn) btn.click();
                    else await page.keyboard.press('Enter');
                });

                console.log("SENHA DIGITADA...");
            } else {
                console.log("SENHA NÃO ENCONTRADA...");
                await page.waitForSelector('input[type="password"]', { timeout: 60000 });

                await page.type('input[type="password"]', googleAccount.password, { delay: 150 });
                await wait(2200);
                await page.click('#passwordNext');

            }

            await wait(15000);

            await debugPage(page, "after-password");

            console.log('Aguardando aprovação do 2FA...');

            const codePrompt = await page.evaluate(() => {

                const nodes = [...document.querySelectorAll("div, span")];

                const el = nodes.find(n => {
                    const text = (n.innerText || "").trim();
                    return /^\d{1,3}$/.test(text);
                });

                return el ? el.innerText : null;
            });

            if (codePrompt) {
                console.log("CÓDIGO PARA CONFIRMAR NO CELULAR:", codePrompt);
            } else {
                console.log("NÃO IDENTIFICOU PEDIDO DE UM CÓDIGO");
            }

            await page.waitForFunction(() => {
                return !window.location.href.includes('accounts.google.com');
            }, { timeout: 120000 });

            console.log('LOGIN REALIZADO COM SUCESSO');

        } else {
            console.log('JÁ AUTENTICADO');
            await wait(3000);
        }

        const context = browser.defaultBrowserContext();

        await context.setPermission({
            origin: "https://meet.google.com",
            permission: {
                name: "microphone"
            },
            setting: "granted"
        });

        await context.setPermission({
            origin: "https://meet.google.com",
            permission: {
                name: "camera"
            },
            setting: "granted"
        });

        await wait(2000);

        await page.goto(meetLink, {
            waitUntil: "networkidle2"
        });

        await wait(5000);

        let attempts = 0;
        let joinedMeet = false;


        while (!joinedMeet && attempts < 20) {
            console.log("TENTATIVAS PARA ACESSAR O MEET... TENTATIVA", attempts);

            await page.evaluate(async () => {
                const enterButtonOptions = ["participar", "join"];

                const buttons = [...document.querySelectorAll("button")];
                const btn = buttons.find(el => {
                    const text = (el.innerText || "").toLowerCase().trim();
                    return enterButtonOptions.some(t => text.includes(t));
                });

                if (btn) btn.click();
            });

            await wait(18000);

            joinedMeet = await page.evaluate(async () => {

                const meetButtonOptions = ["meeting_room", "call_end"];
                const buttons = [...document.querySelectorAll("button")];
                const btn = buttons.find(el => {
                    const text = (el.innerText || "").toLowerCase().trim();
                    return meetButtonOptions.some(t => text.includes(t));
                });

                const texts = [...document.querySelectorAll("div, span")].map(el => (el.innerText || "").toLowerCase());
                const waiting = texts.some(t =>
                    t.includes("pedindo para participar") ||
                    t.includes("aguardando") ||
                    t.includes("aguarde") ||
                    t.includes("waiting")
                );

                const videos = document.querySelectorAll("video");
                const audios = document.querySelectorAll("audio");

                const hasMedia = videos.length > 0 || audios.length > 0;

                if (hasMedia && btn && !waiting) {
                    return true;
                } else {
                    return false;
                }

            });

            if (!joinedMeet) await wait(20000);

            attempts++;
        }

        if (!joinedMeet) {
            console.error("❌ NÃO TEVE PERMISSÃO PARA ENTRAR NA CALL`");
            await page.close();
            return false;
        }

        console.log('✅ ENTROU NA CALL');

        let hasParticipants = true;
        let maxRecordingTime = 0;
        let noRecordingErrors = true;

        recorder = startAudioRecording();


        while (hasParticipants && noRecordingErrors && maxRecordingTime < 28) {

            if (!estaGravando(recorder)) {
                noRecordingErrors = false;
                console.log("Gravação parou!");
            }

            const participants = await page.evaluate(async () => {
                const el = document.getElementsByClassName("egzc7c")[0]?.children[0]?.children[0];
                if (!el) {
                    console.error("NÃO ENCONTROU CONTADOR DE PARTICIPANTES");
                    return 2;
                }
                return parseInt(el.innerHTML.trim()) || 0;
            });

            console.log("PARTICIPANTES:", participants);

            if (participants > 1) hasParticipants = true;
            else hasParticipants = false;

            console.log("CONTEM PARTICIPANTES:", hasParticipants);


            if (hasParticipants) await wait(300000);

            maxRecordingTime++;
        }

        console.log("FINALIZADO");

        if (recorder) recorder.kill("SIGINT");
        await page.close();

        return true;
    } catch (error) {
        console.log("❌ ERROR PROCESSO:", error);

        await debugPage(page, "fatal-error");

        if (recorder) recorder.kill("SIGINT");
        await page.close();

        return false;
    }
}

async function start() {
    console.log("INICIANDO BOT URL:", process.argv[2]);
    startAttempts++;

    if (startAttempts > 20) {
        process.exit(0);
    }

    const isDocker = process.env.VIA_DOCKER ? true : false;

    const browser = await puppeteer.launch({
        headless: isDocker ? "new" : false,
        executablePath: "/usr/bin/chromium",
        userDataDir: isDocker ? "/chrome-session" : "./chrome-session",
        defaultViewport: null,
        args: [
            "--lang=pt-BR",
            "--window-size=1280,800",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-features=site-per-process",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
            "--disable-client-side-phishing-detection",
            "--disable-default-apps",
            "--disable-hang-monitor",
            "--disable-popup-blocking",
            "--disable-sync",
            "--metrics-recording-only",
            "--no-first-run",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
            "--disable-blink-features=AutomationControlled",
            "--lang=en-US,en",
        ],
    }).catch(async error => {
        const errorReturn = error.toString().match("Missing X server to start the headful browser") ? "Missing X server to start the headful browser" : error.toString().match("The profile appears to be in use by another Chromium process") ? "The profile appears to be in use by another Chromium process" : error.toString().match("Use a different `userDataDir` or stop the running browser first") ? "Use a different `userDataDir` or stop the running browser first" : error.toString().match("TargetCloseError: Protocol error") ? "TargetCloseError: Protocol error" : null;
        if (errorReturn) {
            try {
                await fs.rmSync(isDocker ? "/chrome-session" : "./chrome-session", { recursive: true, force: true });
            } catch (error) { }

            await setTimeout(resolve({}), 2550);

            console.log("FALHA AO RODAR START: ", errorReturn);
            await start();
        } else {
            console.log("ERRO INICIAR BROWSER:", error);
        }
    });

    if (browser) console.log("BROWSER INICIADO");

    await startNavegation(process.argv[2], browser);
}

start();