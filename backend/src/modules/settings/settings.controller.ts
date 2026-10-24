// Settings HTTP controller.
import type { RequestHandler } from "express";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import {
  parseSettingInput,
  parseSettingsBatch,
  parseSettingsQuery,
} from "./settings.schema.js";
import * as service from "./settings.service.js";

export const getSettings: RequestHandler = async (req, res) => {
  const em = getEntityManager(req);
  const filter = parseSettingsQuery(req.query as Record<string, unknown>);

  const rawKey = req.params.key;
  const paramKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

  if (paramKey) {
    const setting = await service.getSettingRecord(
      em,
      paramKey,
      filter.vehicleId,
    );
    res.json({
      success: true,
      message: "Setting retrieved successfully",
      data: setting,
    });
    return;
  }

  if (filter.key) {
    const setting = await service.getSettingRecord(
      em,
      filter.key,
      filter.vehicleId,
    );
    res.json({
      success: true,
      message: "Setting retrieved successfully",
      data: setting,
    });
    return;
  }

  if (req.query.raw === "true" || req.query.list === "true") {
    const settings = await service.listStoredSettings(em, filter);
    res.json({
      success: true,
      message: "Settings retrieved successfully",
      data: settings,
    });
    return;
  }

  const effectiveMap = await service.getEffectiveSettingsMap(
    em,
    filter.vehicleId,
  );
  res.json({
    success: true,
    message: "Settings retrieved successfully",
    data: effectiveMap,
  });
};

export const updateSettings: RequestHandler = async (req, res) => {
  const em = getEntityManager(req);

  const rawKey = req.params.key;
  const paramKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

  // If a key is passed in URL params, e.g. PATCH /settings/:key
  if (paramKey) {
    const input = parseSettingInput({
      key: paramKey,
      value: req.body?.value !== undefined ? req.body.value : req.body,
      scope: req.body?.scope,
      vehicleId: req.body?.vehicleId,
    });
    const updated = await service.upsertSetting(em, input);
    res.json({
      success: true,
      message: "Setting updated successfully",
      data: updated,
    });
    return;
  }

  const inputs = parseSettingsBatch(req.body);
  if (inputs.length === 1) {
    const updated = await service.upsertSetting(em, inputs[0]);
    res.json({
      success: true,
      message: "Setting updated successfully",
      data: updated,
    });
    return;
  }

  const results = await service.upsertSettingsBatch(em, inputs);
  res.json({
    success: true,
    message: "Settings updated successfully",
    data: results,
  });
};
