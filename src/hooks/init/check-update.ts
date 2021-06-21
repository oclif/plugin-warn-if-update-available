import { Hook } from "@oclif/config";
import libnpm, { Manifest } from "libnpm";
import * as semver from "semver";
import * as fs from "fs-extra";
import * as path from "path";
import cli from "cli-ux";

const timeoutInDays = 10;

const hook: Hook<"init"> = async function ({ config }) {
  const { name: packageName, version: currentVersion } = config;
  const updateCheckPath = path.join(config.cacheDir, "last-update-check");

  const refreshNeeded = async () => {
    try {
      const { mtime } = await fs.stat(updateCheckPath);
      const staleAt = new Date(
        mtime.valueOf() + 1000 * 60 * 60 * 24 * timeoutInDays
      );
      return staleAt < new Date();
    } catch (err) {
      return true;
    }
  };

  const checkForUpdate = async () => {
    try {
      cli.action.start("checking for updates");

      const latestManifest: Manifest = await libnpm.manifest(
        `${packageName}@latest`,
        libnpm.config.read()
      );

      await fs.writeFile(updateCheckPath, JSON.stringify(latestManifest), {
        encoding: "utf8",
      });
    } finally {
      cli.action.stop();
    }

    await checkVersion(true);
  };

  const readLatestManifest = async (): Promise<Manifest | null> => {
    try {
      return JSON.parse(
        await fs.readFile(updateCheckPath, {
          encoding: "utf8",
        })
      );
    } catch (err) {
      return null;
    }
  };

  const checkVersion = async (printStatus?: boolean) => {
    const latestManifest = await readLatestManifest();

    // No version check has happened, so we can't tell if we're the latest version:
    if (latestManifest === null) {
      return null;
    }

    if (semver.lt(currentVersion, latestManifest.version)) {
      this.warn(
        `Update needed, please run \`yarn global add ${packageName}@latest\`\n`
      );
    } else if (printStatus) {
      this.log("All up-to-date!\n");
    }
  };

  if (await refreshNeeded()) {
    await checkForUpdate();
  } else {
    await checkVersion();
  }
};

export default hook;
