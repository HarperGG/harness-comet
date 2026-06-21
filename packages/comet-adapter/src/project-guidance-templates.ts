export type GuidanceLanguage = "en" | "zh";

export function rulesTemplate(language: GuidanceLanguage): string {
  if (language === "zh") {
    return "# \u9879\u76ee\u89c4\u5219\n\n\u672c\u6587\u4ef6\u8bb0\u5f55\u7528\u6237\u660e\u786e\u63d0\u51fa\u5e76\u786e\u8ba4\u7684\u9879\u76ee\u7ea7\u957f\u671f\u89c4\u5219\u3002\n\n## \u7ea2\u7ebf\n\n\u5f53\u524d\u6682\u65e0\u5df2\u786e\u8ba4\u7ea2\u7ebf\u3002\n\n## \u5de5\u7a0b\u51c6\u5219\n\n\u5f53\u524d\u6682\u65e0\u5df2\u786e\u8ba4\u5de5\u7a0b\u51c6\u5219\u3002\n";
  }
  return "# Project Rules\n\nThis file records long-lived project rules explicitly stated and confirmed by the user.\n\n## Red Lines\n\nNo confirmed red lines yet.\n\n## Engineering Guidelines\n\nNo confirmed engineering guidelines yet.\n";
}

export function structureTemplate(language: GuidanceLanguage): string {
  if (language === "zh") {
    return "# \u9879\u76ee\u7ed3\u6784\n\n\u672c\u6587\u4ef6\u63cf\u8ff0\u9879\u76ee\u5f53\u524d\u7684\u903b\u8f91\u7ed3\u6784\u3001\u4e3b\u8981\u76ee\u5f55\u548c\u6a21\u5757\u804c\u8d23\u3002\n\n## \u9879\u76ee\u6982\u89c8\n\n\u5f85\u540e\u7eed\u5f52\u6863\u6d41\u7a0b\u9010\u6b65\u8865\u5145\u3002\n\n## \u4e3b\u8981\u76ee\u5f55\u548c\u6a21\u5757\n\n\u5f85\u8865\u5145\u3002\n";
  }
  return "# Project Structure\n\nThis file describes the current logical structure, important directories, and module responsibilities.\n\n## Overview\n\nTo be refined by future archive workflows.\n\n## Important Directories and Modules\n\nTo be documented.\n";
}
