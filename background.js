const adPatterns = [
  "*://pubads.g.doubleclick.net/*",
  "*://securepubads.g.doubleclick.net/*",
  "*://*.ads.twitch.tv/*",
  "*://ads-v-darwin.hulustream.com/*",
  "*://ads.twitch.tv/*",
  "*://amazon-adsystem.com/*",
  "*://*.amazonaws.com/*/ad-*.mp4*",
  "*://*.video-ad-*.mp4*",
  "*://video-weaver.*.hls.ttvnw.net/*/ad-*.m4s*",
  "*://video-weaver.*.hls.ttvnw.net/*/ad-*.ts*",
];

chrome.declarativeNetRequest.getDynamicRules((rules) => {
  const rulesToRemove = rules.map((rule) => rule.id);
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: rulesToRemove,
      addRules: adPatterns.map((pattern, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: pattern,
          resourceTypes: ["xmlhttprequest", "media", "script"],
        },
      })),
    },
    () => {
      if (chrome.runtime.lastError) {
        console.log(
          "Ad blocking rules setup failed:",
          chrome.runtime.lastError
        );
      } else {
        console.log("Ad blocking rules applied successfully");
      }
    }
  );
});
