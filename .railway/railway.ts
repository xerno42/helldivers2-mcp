import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const helldivers2Mcp = service("helldivers2-mcp", {
    source: github("xerno42/helldivers2-mcp", { checkSuites: false }),
    replicas: { "us-west2": 1 },
    domains: [{ domain: "mcp.avengersofsuperearth.com", port: 3000 }],
    env: { X_SUPER_CONTACT: preserve(), PORT: "3000" },
  });

  return project("helldivers2-mcp", {
    resources: [helldivers2Mcp],
  });
});
