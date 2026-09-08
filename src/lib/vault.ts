import type { VaultAPI } from "./api";
import { getCloudConfig } from "./config";
import { createCloudApi } from "./cloud";
import { createLocalApi } from "./local";

export function createVault(): VaultAPI {
  const cloud = getCloudConfig();
  return cloud ? createCloudApi(cloud) : createLocalApi();
}
