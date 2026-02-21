/**
 * Work around pnpm symlink resolution in autolinking by pinning Expo's Android
 * package path for RN PackageList generation.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
