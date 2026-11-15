const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

/**
 * react-native-wifi-reborn 4.13.6 passes Gradle properties as unquoted
 * identifiers. On the current Android Gradle Plugin this can resolve to null
 * while evaluating the module. Pass the property names as strings instead.
 */
function withWifiRebornGradleFix(config) {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const gradleFile = path.join(
      modConfig.modRequest.projectRoot,
      "node_modules",
      "react-native-wifi-reborn",
      "android",
      "build.gradle",
    );

    let contents = await fs.readFile(gradleFile, "utf8");
    const replacements = [
      ["safeExtGet(compileSdkVersion, 31)", "safeExtGet('compileSdkVersion', 31)"],
      ["safeExtGet(minSdkVersion, 21)", "safeExtGet('minSdkVersion', 21)"],
      ["safeExtGet(targetSdkVersion, 31)", "safeExtGet('targetSdkVersion', 31)"],
    ];

    for (const [before, after] of replacements) {
      contents = contents.replaceAll(before, after);
    }

    await fs.writeFile(gradleFile, contents, "utf8");
    return modConfig;
  }]);
}

module.exports = withWifiRebornGradleFix;
