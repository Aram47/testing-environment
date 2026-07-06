import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backendTestExample, dockerComposeExample } from '../../../lib/examples';
import type { EnvironmentConfig, EnvironmentVisualConfig } from '../../../types';
import { createDefaultVisualConfig } from '../lib/environmentDefaults';

export type EnvironmentEditorMode = 'visual' | 'raw_yaml';

function snapshotFromValue(value?: EnvironmentConfig) {
  return {
    mode: (value && !value.visualConfig ? 'raw_yaml' : 'visual') as EnvironmentEditorMode,
    dockerComposeYaml: value?.dockerComposeYaml ?? dockerComposeExample,
    backendTestYaml: value?.backendTestYaml ?? backendTestExample,
    visualConfig: value?.visualConfig ?? createDefaultVisualConfig(),
    baseRevisionId: value?.currentRevision?.id,
  };
}

function serializeForCompare(input: {
  mode: EnvironmentEditorMode;
  dockerComposeYaml: string;
  backendTestYaml: string;
  visualConfig: EnvironmentVisualConfig;
}) {
  if (input.mode === 'visual') {
    return JSON.stringify(input.visualConfig);
  }
  return `${input.dockerComposeYaml}\n---\n${input.backendTestYaml}`;
}

export function useEnvironmentEditorState(value?: EnvironmentConfig) {
  const baselineRef = useRef(snapshotFromValue(value));
  const [mode, setModeState] = useState<EnvironmentEditorMode>(baselineRef.current.mode);
  const [dockerComposeYaml, setDockerComposeYaml] = useState(baselineRef.current.dockerComposeYaml);
  const [backendTestYaml, setBackendTestYaml] = useState(baselineRef.current.backendTestYaml);
  const [visualConfig, setVisualConfig] = useState<EnvironmentVisualConfig>(baselineRef.current.visualConfig);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [baseRevisionId, setBaseRevisionId] = useState<string | undefined>(baselineRef.current.baseRevisionId);

  const resetFromServer = useCallback((nextValue?: EnvironmentConfig) => {
    const snapshot = snapshotFromValue(nextValue);
    baselineRef.current = snapshot;
    setModeState(snapshot.mode);
    setDockerComposeYaml(snapshot.dockerComposeYaml);
    setBackendTestYaml(snapshot.backendTestYaml);
    setVisualConfig(snapshot.visualConfig);
    setBaseRevisionId(snapshot.baseRevisionId);
    setWarnings([]);
  }, []);

  useEffect(() => {
    const revisionId = value?.currentRevision?.id;
    if (revisionId && revisionId !== baselineRef.current.baseRevisionId) {
      resetFromServer(value);
    }
  }, [value, resetFromServer]);

  const isDirty = useMemo(() => {
    const current = serializeForCompare({ mode, dockerComposeYaml, backendTestYaml, visualConfig });
    const baseline = serializeForCompare({
      mode: baselineRef.current.mode,
      dockerComposeYaml: baselineRef.current.dockerComposeYaml,
      backendTestYaml: baselineRef.current.backendTestYaml,
      visualConfig: baselineRef.current.visualConfig,
    });
    return current !== baseline;
  }, [mode, dockerComposeYaml, backendTestYaml, visualConfig]);

  const setMode = useCallback((nextMode: EnvironmentEditorMode) => {
    setModeState(nextMode);
  }, []);

  const sourceMode = mode === 'visual' ? 'VISUAL' : 'RAW_YAML';

  return {
    mode,
    setMode,
    sourceMode,
    dockerComposeYaml,
    setDockerComposeYaml,
    backendTestYaml,
    setBackendTestYaml,
    visualConfig,
    setVisualConfig,
    warnings,
    setWarnings,
    baseRevisionId,
    isDirty,
    resetFromServer,
  };
}
