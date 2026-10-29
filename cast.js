// Maakt van deze pagina een Cast-app op de Nest Hub en houdt hem wakker.
// De Hub sluit een cast-app na ongeveer 10 minuten als er geen media speelt. Daarom "speelt" een
// onzichtbare mediaspeler elke 9 minuten een plaatje af (dezelfde truc als Home Assistant Cast).
(function () {
  "use strict";

  const SDK_URL = "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js";
  const KEEPALIVE_MS = 9 * 60 * 1000;
  const KEEPALIVE_IMAGE = new URL("pip.png", location.href).href;
  // Zo staat het overzicht als kaartje in het menu van de Google Hub (tik erop en
  // je bent terug). Kort, zodat de tekst niet schuift. Een plaatje laat Google
  // daar niet zien, ook niet als muziek; als muziek kreeg het kaartje alleen een
  // knop "volgende" die niets doet.
  const MENU_TITLE = "Overzicht";
  const MENU_SUBTITLE = "Pip";
  const MENU_PHOTO = new URL("pip-icoon.jpg", location.href).href;
  // Kanaal waarover de startknop de Voerraad-koppelcode (niet in config.js: die is
  // openbaar) en de huisgenoten stuurt.
  const NAMESPACE = "urn:x-cast:nl.pip.hub";

  // In een gewone browser is dit alleen een voorbeeld; de Cast-code draait alleen op de Hub.
  if (!/CrKey|Fuchsia/.test(navigator.userAgent)) return;

  const script = document.createElement("script");
  script.src = SDK_URL;
  script.onload = startReceiver;
  document.head.appendChild(script);

  function startReceiver() {
    const framework = cast.framework;
    const context = framework.CastReceiverContext.getInstance();
    const playerManager = context.getPlayerManager();

    const player = document.createElement("cast-media-player");
    player.style.display = "none";
    document.body.appendChild(player);

    // Zodra er media speelt legt de Hub bedieningsknoppen over het scherm, die alle tikken afvangen.
    new MutationObserver(hideTouchControls).observe(document.body, { childList: true, subtree: true });

    context.addEventListener(framework.system.EventType.READY, () => {
      playDummyMedia();
      setInterval(playDummyMedia, KEEPALIVE_MS);
    });

    context.addCustomMessageListener(NAMESPACE, (event) => {
      const data = event.data || {};
      if (!window.Pip) return;
      if (data.type === "voerraad-code" && typeof data.code === "string") window.Pip.setVoerraadCode(data.code);
      if (data.type === "kattenbak-code" && typeof data.code === "string") window.Pip.setActionCode(data.code);
      if (data.type === "people" && Array.isArray(data.people)) window.Pip.setPeople(data.people);
      // Video: Pip meldt terug hoe het afspelen gaat (laden, spelen, fout).
      if (data.type === "video") {
        window.Pip.playVideo(data, (status) =>
          context.sendCustomMessage(NAMESPACE, event.senderId, { type: "video-status", ...status }));
      }
      if (data.type === "video-close") window.Pip.closeVideo();
    });

    // Voor de knop "Google Hub": Pip sluit zichzelf, de Hub toont weer zijn eigen scherm.
    window.PipCast = { stop: () => context.stop() };

    const options = new framework.CastReceiverOptions();
    options.disableIdleTimeout = true;
    options.statusText = `${MENU_TITLE} van ${MENU_SUBTITLE}`;
    options.customNamespaces = { [NAMESPACE]: framework.system.MessageType.JSON };
    context.start(options);

    function playDummyMedia() {
      const request = new framework.messages.LoadRequestData();
      request.autoplay = true;
      request.media = new framework.messages.MediaInformation();
      request.media.contentId = KEEPALIVE_IMAGE;
      request.media.contentType = "image/png";
      request.media.streamType = framework.messages.StreamType.NONE;
      request.media.metadata = new framework.messages.GenericMediaMetadata();
      request.media.metadata.title = MENU_TITLE;
      request.media.metadata.subtitle = MENU_SUBTITLE;
      request.media.metadata.images = [new framework.messages.Image(MENU_PHOTO)];
      request.requestId = 0;
      playerManager.load(request);
    }
  }

  function hideTouchControls() {
    const controls = document.querySelector("touch-controls");
    if (controls && controls.style.display !== "none") controls.style.display = "none";
  }
})();
