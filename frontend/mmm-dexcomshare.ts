import getDexcomModuleProperties from "./getDexcomModuleProperties";

const dexcomModuleProperties = getDexcomModuleProperties(
  ModuleDetails.name,
  ModuleDetails.version
);

Module.register(ModuleDetails.name, dexcomModuleProperties);
