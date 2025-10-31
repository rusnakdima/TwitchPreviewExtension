(function () {
  "use strict";

  const VIEW_HISTORY_KEY = "history";

  let floatingPreviewContainer = null;
  let floatingPreviewIframe = null;
  let currentFloatingChannel = null;
  let hoverTimeout = null;
  let hideTimeout = null;
  let isFloatingPreviewVisible = false;
  let isMouseOverFloatingPreview = false;
  let isMouseOverSidebarTarget = false;
  let currentSidebarTarget = null;
  const HOVER_DELAY = 500;
  const HIDE_DELAY = 300;

  const SIDEBAR_SELECTORS = [
    ".side-nav-card",
    ".sidebar-channel-link",
    '[data-a-target*="side-nav"]',
  ].join(",");
  const GRID_SELECTORS = [
    '[data-a-target="preview-card-image-link"]',
    ".live-channel-card",
    ".offline-channel-card",
    '[class*="card"]',
  ].join(",");

  let pipIframe = null;
  let pipRequestTime = 0;
  let isFloatingPreviewInPip = false;

  function cleanupAllGridPreviews() {
    const activeIframes = document.querySelectorAll(
      'iframe[data-grid-card="active"]'
    );
    activeIframes.forEach((iframe) => {
      const imageContainer = iframe.parentElement;
      if (imageContainer) {
        iframe.remove();

        const allChildren = Array.from(imageContainer.children);
        allChildren.forEach((child) => {
          if (
            child.textContent &&
            child.textContent.trim() === "Loading preview..."
          ) {
            child.remove();
          } else {
            child.style.display = "";
          }
        });

        imageContainer.style.cssText = "";
      }
    });
  }

  function logViewed(channel) {
    if (channel) {
      chrome.storage.local.get([VIEW_HISTORY_KEY], (result) => {
        const history = result[VIEW_HISTORY_KEY] || {};
        if (!history[channel]) {
          history[channel] = [];
        }
        const now = Date.now();
        const lastTimestamp = history[channel][history[channel].length - 1];
        if (!lastTimestamp || now - lastTimestamp > 60000) {
          history[channel].push(now);
          if (history[channel].length > 100) {
            history[channel] = history[channel].slice(-100);
          }
          chrome.storage.local.set({ [VIEW_HISTORY_KEY]: history });
        }
      });
    }
  }

  function getCurrentChannel() {
    const path = window.location.pathname;
    if (path.startsWith("/") && path.split("/").length === 2) {
      const potentialChannel = path.split("/")[1].toLowerCase();
      const mainContent = document.querySelector("main");
      if (mainContent && potentialChannel) {
        return potentialChannel;
      }
    }
    let channelElement = document.querySelector(
      ".persistent-player .channel-info a, .metadata-layout__support a"
    );
    if (channelElement && channelElement.textContent) {
      return channelElement.textContent.trim().toLowerCase();
    }
    const iframe = document.querySelector('iframe[src*="player.twitch.tv"]');
    if (iframe) {
      const url = new URL(iframe.src);
      const channel = url.searchParams.get("channel");
      if (channel) return channel.toLowerCase();
    }
    return null;
  }

  function isIframeInPictureInPicture(iframe) {
    if (!iframe || !iframe.contentWindow) return false;

    if (pipIframe === iframe) return true;

    if (Date.now() - pipRequestTime < 2000) {
      console.log("PIP recently requested, treating as active");
      return true;
    }

    try {
      const videos = iframe.contentWindow.document.querySelectorAll("video");
      for (let video of videos) {
        if (document.pictureInPictureElement === video) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function createFloatingPreviewContainer() {
    if (floatingPreviewContainer) return;
    floatingPreviewContainer = document.createElement("div");
    floatingPreviewContainer.id = "twitch-preview-container";
    floatingPreviewContainer.style.cssText = `
      position: fixed;
      width: 400px;
      height: 225px;
      z-index: 10000;
      background: #18181b;
      border: 2px solid #9147ff;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      display: none;
      overflow: hidden;
      pointer-events: auto;
    `;
    floatingPreviewIframe = document.createElement("iframe");
    floatingPreviewIframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;
    floatingPreviewIframe.setAttribute(
      "allow",
      "autoplay; fullscreen; picture-in-picture"
    );

    floatingPreviewContainer.addEventListener(
      "click",
      (e) => {
        pipRequestTime = Date.now();
        console.log(
          "Click detected on floating preview - PIP might be requested"
        );
      },
      true
    );

    floatingPreviewContainer.addEventListener("mouseenter", () => {
      isMouseOverFloatingPreview = true;
      clearTimeout(hideTimeout);
    });
    floatingPreviewContainer.addEventListener("mouseleave", () => {
      isMouseOverFloatingPreview = false;
      scheduleHideFloating();
    });
    floatingPreviewContainer.appendChild(floatingPreviewIframe);
    document.body.appendChild(floatingPreviewContainer);
  }

  function getChannelFromElement(element) {
    const link = element.closest('a[href*="/"]');
    if (link) {
      const href = link.getAttribute("href");
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && match[1]) {
        const channel = match[1].toLowerCase();
        const excludedPages = [
          "directory",
          "videos",
          "downloads",
          "settings",
          "subscriptions",
          "inventory",
          "drops",
          "following",
        ];
        if (!excludedPages.includes(channel)) {
          return channel;
        }
      }
    }
    const channelAttr = element.getAttribute("data-a-target");
    if (channelAttr && channelAttr.includes("user")) {
      return element.textContent.trim().toLowerCase();
    }
    return null;
  }

  function calculateFloatingPosition(targetElement, mouseX, mouseY) {
    const previewWidth = 400;
    const previewHeight = 225;
    const padding = 20;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const rect = targetElement.getBoundingClientRect();
    let x = rect.right + padding;
    let y = rect.top;
    if (x + previewWidth > windowWidth - padding) {
      x = rect.left - previewWidth - padding;
    }
    if (y < padding) {
      y = padding;
    }
    if (y + previewHeight > windowHeight - padding) {
      y = windowHeight - previewHeight - padding;
    }
    if (x < padding) {
      x = padding;
    }
    return { x, y };
  }

  function showFloatingPreview(channel, targetElement, mouseX, mouseY) {
    if (!channel) return;
    if (channel === currentFloatingChannel && isFloatingPreviewVisible) return;

    currentFloatingChannel = channel;
    currentSidebarTarget = targetElement;

    const inPip = isFloatingPreviewInPip;
    if (!inPip || floatingPreviewIframe.src === "") {
      const embedUrl = `https://player.twitch.tv/?channel=${channel}&parent=twitch.tv&muted=false&time=${Date.now()}`;
      floatingPreviewIframe.src = embedUrl;
    }

    const pos = calculateFloatingPosition(targetElement, mouseX, mouseY);
    floatingPreviewContainer.style.left = pos.x + "px";
    floatingPreviewContainer.style.top = pos.y + "px";
    floatingPreviewContainer.style.display = "block";
    floatingPreviewContainer.style.visibility = "visible";
    floatingPreviewContainer.style.pointerEvents = "auto";
    isFloatingPreviewVisible = true;

    if (!inPip) {
      setTimeout(() => {
        if (isFloatingPreviewVisible && currentFloatingChannel === channel) {
          logViewed(channel);
        }
      }, 3000);
    }
  }

  function scheduleHideFloating() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (!isMouseOverFloatingPreview && !isMouseOverSidebarTarget) {
        const inPip = isFloatingPreviewInPip;

        if (inPip) {
          console.log("Hiding container but keeping PIP active");
          hideFloatingPreviewContainer();
        } else {
          console.log("Fully hiding preview");
          hideFloatingPreview();
        }
      }
    }, HIDE_DELAY);
  }

  function hideFloatingPreview() {
    if (floatingPreviewContainer) {
      floatingPreviewContainer.style.display = "none";

      if (!isFloatingPreviewInPip) {
        floatingPreviewIframe.src = "";
      }

      currentFloatingChannel = null;
      currentSidebarTarget = null;
      isFloatingPreviewVisible = false;
      isMouseOverFloatingPreview = false;
      isMouseOverSidebarTarget = false;
    }
  }

  function hideFloatingPreviewContainer() {
    if (floatingPreviewContainer) {
      floatingPreviewContainer.style.visibility = "hidden";
      floatingPreviewContainer.style.pointerEvents = "none";
      isFloatingPreviewVisible = false;
      isMouseOverFloatingPreview = false;
      isMouseOverSidebarTarget = false;
    }
  }

  function createGridInlinePreview(channel, gridCard) {
    const imageContainer =
      gridCard.querySelector("img")?.parentElement ||
      gridCard.querySelector('[class*="image"]') ||
      gridCard.querySelector("a");
    if (!imageContainer) return null;

    const containerRect = imageContainer.getBoundingClientRect();
    const originalStyle = imageContainer.style.cssText;

    imageContainer.style.width = containerRect.width + "px";
    imageContainer.style.height = containerRect.height + "px";
    imageContainer.style.position = "relative";
    imageContainer.style.overflow = "hidden";
    imageContainer.style.display = "block";

    const loadingOverlay = document.createElement("div");
    loadingOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.3s ease;
      color: #fff;
      font-family: 'Roobert', 'Inter', 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
    `;
    loadingOverlay.textContent = "Loading preview...";

    const iframe = document.createElement("iframe");
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: ${containerRect.height}px;
      border: none;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 100;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
    iframe.src = `https://player.twitch.tv/?channel=${channel}&parent=twitch.tv&muted=false&time=${Date.now()}`;
    iframe.dataset.gridCard = "active";

    const originalChildren = Array.from(imageContainer.children);
    originalChildren.forEach((c) => (c.style.display = "none"));

    imageContainer.appendChild(loadingOverlay);
    imageContainer.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        iframe.style.opacity = "1";
        loadingOverlay.style.opacity = "0";
        setTimeout(() => loadingOverlay.remove(), 300);
      }, 300);
    };

    setTimeout(() => {
      logViewed(channel);
    }, 3000);
    setTimeout(() => {
      if (iframe.parentElement) {
        const base = iframe.src.split("&time=")[0];
        iframe.src = `${base}&time=${Date.now()}`;
      }
    }, 1500);

    return {
      iframe,
      imageContainer,
      gridCard,
      originalStyle,
      originalChildren,
      restore() {
        iframe.remove();
        if (loadingOverlay.parentElement) loadingOverlay.remove();
        originalChildren.forEach((c) => (c.style.display = ""));
        imageContainer.style.cssText = originalStyle;
      },
    };
  }

  function handleSidebarMouseEnter(e) {
    if (!(e.target instanceof Element)) return;
    const element = e.target.closest(SIDEBAR_SELECTORS);
    if (!element) return;
    const channel = getChannelFromElement(element);
    if (!channel) return;
    isMouseOverSidebarTarget = true;
    currentSidebarTarget = element;
    clearTimeout(hoverTimeout);
    clearTimeout(hideTimeout);
    hoverTimeout = setTimeout(() => {
      if (isMouseOverSidebarTarget) {
        showFloatingPreview(channel, element, e.clientX, e.clientY);
      }
    }, HOVER_DELAY);
  }

  function handleSidebarMouseLeave(e) {
    if (!(e.target instanceof Element)) return;
    const element = e.target.closest(SIDEBAR_SELECTORS);
    if (!element) return;
    if (
      element === currentSidebarTarget ||
      element.contains(currentSidebarTarget)
    ) {
      isMouseOverSidebarTarget = false;
      clearTimeout(hoverTimeout);
      scheduleHideFloating();
    }
  }

  function handleGridMouseEnter(e) {
    if (!(e.target instanceof Element)) return;
    const sidebarElement = e.target.closest(SIDEBAR_SELECTORS);
    if (sidebarElement) return;
    const gridCard = e.target.closest(GRID_SELECTORS);
    if (!gridCard) return;
    const channel = getChannelFromElement(gridCard);
    if (!channel) return;

    if (gridCard.querySelector('iframe[data-grid-card="active"]')) {
      clearTimeout(hoverTimeout);
      return;
    }
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      if (!gridCard.querySelector('iframe[data-grid-card="active"]')) {
        createGridInlinePreview(channel, gridCard);
      }
    }, HOVER_DELAY);
  }

  function handleGridMouseLeave(e) {
    if (!(e.target instanceof Element)) return;
    const gridCard = e.target.closest(GRID_SELECTORS);
    if (!gridCard) return;
    clearTimeout(hoverTimeout);
  }

  function attachListeners() {
    document.addEventListener("mouseenter", handleSidebarMouseEnter, true);
    document.addEventListener("mouseleave", handleSidebarMouseLeave, true);
    document.addEventListener("mouseenter", handleGridMouseEnter, true);
    document.addEventListener("mouseleave", handleGridMouseLeave, true);
  }

  function init() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    createFloatingPreviewContainer();
    attachListeners();

    document.addEventListener(
      "play",
      (e) => {
        if (e.target.tagName === "VIDEO") {
          setTimeout(() => {
            const channel = getCurrentChannel();
            logViewed(channel);
          }, 1000);
        }
      },
      true
    );

    setTimeout(() => {
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        if (!video.paused) {
          logViewed(getCurrentChannel());
        }
      });
    }, 2000);

    window.addEventListener(
      "scroll",
      () => {
        if (isFloatingPreviewVisible && !isMouseOverFloatingPreview) {
          const inPip = isFloatingPreviewInPip;
          if (inPip) {
            hideFloatingPreviewContainer();
          } else {
            hideFloatingPreview();
          }
        }
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (isFloatingPreviewVisible) {
          const inPip = isFloatingPreviewInPip;
          if (inPip) {
            hideFloatingPreviewContainer();
          } else {
            hideFloatingPreview();
          }
        }
        cleanupAllGridPreviews();
      }
    });

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;

        if (
          floatingPreviewContainer &&
          floatingPreviewContainer.contains(target)
        ) {
          pipRequestTime = Date.now();
          console.log("Click inside floating preview - PIP might be requested");
        }
      },
      true
    );

    document.addEventListener("enterpictureinpicture", (e) => {
      console.log("enterpictureinpicture event fired");
      const video = e.target;
      if (!video) return;

      const iframe = video.closest("iframe");
      console.log(iframe);
      if (!iframe) return;

      pipIframe = iframe;
      pipRequestTime = 0;
      console.log(
        "PIP iframe tracked:",
        iframe === floatingPreviewIframe ? "floating preview" : "other"
      );

      if (iframe === floatingPreviewIframe || isFloatingPreviewVisible) {
        isFloatingPreviewInPip = true;
        console.log("Hiding floating preview container for PIP");
        hideFloatingPreviewContainer();
      }
    });

    document.addEventListener("leavepictureinpicture", (e) => {
      console.log("leavepictureinpicture event fired");

      if (pipIframe === floatingPreviewIframe || isFloatingPreviewInPip) {
        console.log("Cleaning up floating preview after PIP exit");
        isFloatingPreviewInPip = false;
        pipIframe = null;
        pipRequestTime = 0;

        setTimeout(() => {
          hideFloatingPreview();
        }, 100);
      } else {
        pipIframe = null;
        pipRequestTime = 0;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
