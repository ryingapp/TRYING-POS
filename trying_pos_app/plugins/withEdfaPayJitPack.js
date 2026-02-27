/**
 * Expo Config Plugin: Adds JitPack repository (with credentials) to 
 * android/build.gradle for the EdfaPay SoftPos native SDK dependency.
 * 
 * This plugin is applied via app.json → plugins
 */

const { withProjectBuildGradle } = require('expo/config-plugins');

function withEdfaPayJitPack(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const buildGradle = config.modResults.contents;

      // Check if JitPack is already added
      if (!buildGradle.includes('jitpack.io')) {
        // Insert JitPack maven repo inside allprojects.repositories
        const allProjectsBlock = `allprojects {
    repositories {
        maven {
            url "https://jitpack.io"
            credentials {
                username "jp_i9ed2av1lj1kjnqpgobpeh0e7k"
            }
        }
    }
}`;

        // Add after the existing allprojects block or at end
        if (buildGradle.includes('allprojects {')) {
          // Insert maven block inside existing allprojects.repositories
          config.modResults.contents = buildGradle.replace(
            /allprojects\s*\{[\s\S]*?repositories\s*\{/,
            (match) => `${match}
        maven {
            url "https://jitpack.io"
            credentials {
                username "jp_i9ed2av1lj1kjnqpgobpeh0e7k"
            }
        }`
          );
        } else {
          // Append allprojects block
          config.modResults.contents = buildGradle + '\n' + allProjectsBlock + '\n';
        }
      }
    }
    return config;
  });
}

module.exports = withEdfaPayJitPack;
