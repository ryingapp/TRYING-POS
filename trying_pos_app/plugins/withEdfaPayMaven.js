/**
 * Expo Config Plugin: Adds the EdfaPay Nexus Maven repository
 * to android/build.gradle for the edfapay-react-native SDK.
 *
 * Also ensures compileSdk = 36 and minSdk = 29 in app/build.gradle.
 *
 * Applied via app.json → plugins → "./plugins/withEdfaPayMaven"
 */

const {
  withProjectBuildGradle,
  withAppBuildGradle,
} = require('expo/config-plugins');

const MAVEN_URL = 'https://build.edfapay.com/nexus/content/repositories/edfapay-mobile/';
const MAVEN_USER = 'your_maven_user';   // Replace with real credentials from EdfaPay
const MAVEN_PASS = 'your_maven_pass';   // Replace with real credentials from EdfaPay

function withEdfaPayMaven(config) {
  // 1. Add Maven repository to project-level build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      const contents = cfg.modResults.contents;

      if (!contents.includes('build.edfapay.com')) {
        const mavenBlock = `
        maven {
            url "${MAVEN_URL}"
            credentials {
                username "${MAVEN_USER}"
                password "${MAVEN_PASS}"
            }
        }`;

        if (contents.includes('allprojects')) {
          // Insert inside existing allprojects.repositories
          cfg.modResults.contents = contents.replace(
            /allprojects\s*\{[\s\S]*?repositories\s*\{/,
            (match) => `${match}${mavenBlock}`
          );
        } else {
          // Append allprojects block
          cfg.modResults.contents =
            contents +
            `\nallprojects {\n    repositories {${mavenBlock}\n    }\n}\n`;
        }
      }
    }
    return cfg;
  });

  // 2. Ensure compileSdk / minSdk meet EdfaPay requirements in app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      let contents = cfg.modResults.contents;

      // compileSdk 36
      contents = contents.replace(
        /compileSdkVersion\s+\d+/,
        'compileSdkVersion 36'
      );
      contents = contents.replace(/compileSdk\s+\d+/, 'compileSdk 36');

      // minSdk 29
      contents = contents.replace(
        /minSdkVersion\s+\d+/,
        'minSdkVersion 29'
      );
      contents = contents.replace(/minSdk\s+\d+/, 'minSdk 29');

      // targetSdk 36
      contents = contents.replace(
        /targetSdkVersion\s+\d+/,
        'targetSdkVersion 36'
      );
      contents = contents.replace(/targetSdk\s+\d+/, 'targetSdk 36');

      // Add packaging excludes for META-INF conflicts
      if (!contents.includes('META-INF/DEPENDENCIES')) {
        contents = contents.replace(
          /android\s*\{/,
          `android {
    packaging {
        resources {
            excludes += [
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/*.kotlin_module"
            ]
        }
    }`
        );
      }

      cfg.modResults.contents = contents;
    }
    return cfg;
  });

  return config;
}

module.exports = withEdfaPayMaven;
