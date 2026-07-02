import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { YamlEditor } from '../../editors/YamlEditor';
import { YamlValidator } from '../../lib/yaml';
import { backendTestExample, dockerComposeExample } from '../../lib/examples';
import type { EnvironmentConfig } from '../../types';

interface EnvironmentEditorProps {
  value?: EnvironmentConfig;
  isSaving: boolean;
  onSave: (value: Omit<EnvironmentConfig, 'projectId'>) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export function EnvironmentEditor({ value, isSaving, onSave, onMessage }: EnvironmentEditorProps) {
  const [dockerComposeYaml, setDockerComposeYaml] = useState(value?.dockerComposeYaml ?? dockerComposeExample);
  const [backendTestYaml, setBackendTestYaml] = useState(value?.backendTestYaml ?? backendTestExample);
  const [mainServiceName, setMainServiceName] = useState(value?.mainServiceName ?? 'api');
  const [healthcheckPath, setHealthcheckPath] = useState(value?.healthcheckPath ?? '/health');
  const [healthcheckExpectedStatus, setHealthcheckExpectedStatus] = useState(value?.healthcheckExpectedStatus ?? 200);
  const [healthcheckTimeoutSeconds, setHealthcheckTimeoutSeconds] = useState(value?.healthcheckTimeoutSeconds ?? 60);

  const validate = () => {
    const compose = YamlValidator.validate(dockerComposeYaml);
    const test = YamlValidator.validate(backendTestYaml);

    if (!compose.ok) {
      onMessage(compose.message, 'error');
      return false;
    }

    if (!test.ok) {
      onMessage(test.message, 'error');
      return false;
    }

    onMessage('YAML is valid', 'success');
    return true;
  };

  const resetExample = () => {
    setDockerComposeYaml(dockerComposeExample);
    setBackendTestYaml(backendTestExample);
    setMainServiceName('api');
    setHealthcheckPath('/health');
    setHealthcheckExpectedStatus(200);
    setHealthcheckTimeoutSeconds(60);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (validate()) {
          onSave({
            id: value?.id,
            dockerComposeYaml,
            backendTestYaml,
            mainServiceName,
            healthcheckPath,
            healthcheckExpectedStatus,
            healthcheckTimeoutSeconds,
            isValid: true,
            updatedAt: value?.updatedAt,
          });
        }
      }}
    >
      <section className="grid gap-6 xl:grid-cols-2">
        <YamlEditor label="docker-compose.test.yml" value={dockerComposeYaml} onChange={setDockerComposeYaml} />
        <YamlEditor label="backend-test.yml" value={backendTestYaml} onChange={setBackendTestYaml} />
      </section>
      <section className="grid gap-5 rounded-lg border border-border bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Main API service</span>
          <input className="input" value={mainServiceName} onChange={(event) => setMainServiceName(event.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Healthcheck path</span>
          <input className="input" value={healthcheckPath} onChange={(event) => setHealthcheckPath(event.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Expected status</span>
          <input className="input" type="number" value={healthcheckExpectedStatus} onChange={(event) => setHealthcheckExpectedStatus(Number(event.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Timeout seconds</span>
          <input className="input" type="number" value={healthcheckTimeoutSeconds} onChange={(event) => setHealthcheckTimeoutSeconds(Number(event.target.value))} />
        </label>
      </section>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={resetExample}>Reset example</Button>
        <Button type="button" variant="secondary" onClick={validate}>Validate YAML</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save configuration'}</Button>
      </div>
    </form>
  );
}
