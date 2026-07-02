import { useState, type ReactNode } from 'react';
import { CheckCircle2, FileCode2, Plus, Trash2 } from 'lucide-react';
import { environmentConfigsApi } from '../../api/environment-configs.api';
import { Button } from '../../components/ui/Button';
import { YamlEditor } from '../../editors/YamlEditor';
import { backendTestExample, dockerComposeExample } from '../../lib/examples';
import { YamlValidator } from '../../lib/yaml';
import type {
  EnvironmentConfig,
  EnvironmentPortMapping,
  EnvironmentServiceConfig,
  EnvironmentVariable,
  EnvironmentVisualConfig,
} from '../../types';

interface EnvironmentEditorProps {
  projectId: string;
  value?: EnvironmentConfig;
  isSaving: boolean;
  onSave: (value: Omit<EnvironmentConfig, 'projectId'>) => void;
  onMessage: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type EditorMode = 'config' | 'yaml';

export function EnvironmentEditor({ projectId, value, isSaving, onSave, onMessage }: EnvironmentEditorProps) {
  const [mode, setMode] = useState<EditorMode>(value && !value.visualConfig ? 'yaml' : 'config');
  const [dockerComposeYaml, setDockerComposeYaml] = useState(value?.dockerComposeYaml ?? dockerComposeExample);
  const [backendTestYaml, setBackendTestYaml] = useState(value?.backendTestYaml ?? backendTestExample);
  const [visualConfig, setVisualConfig] = useState<EnvironmentVisualConfig>(() => value?.visualConfig ?? createDefaultVisualConfig());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  const validateYaml = () => {
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

  const compile = async () => {
    setIsCompiling(true);
    try {
      const result = await environmentConfigsApi.compile(projectId, visualConfig);
      setDockerComposeYaml(result.composeYaml);
      setBackendTestYaml(result.backendTestYaml);
      setWarnings(result.warnings);
      onMessage(result.warnings.length > 0 ? 'Configuration compiled with warnings' : 'Configuration is valid', result.warnings.length > 0 ? 'info' : 'success');
      return true;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Environment validation failed', 'error');
      return false;
    } finally {
      setIsCompiling(false);
    }
  };

  const saveConfig = async () => {
    if (!(await compile())) {
      return;
    }
    onSave({
      id: value?.id,
      dockerComposeYaml,
      backendTestYaml,
      visualConfig,
      mainServiceName: visualConfig.app.mainServiceName,
      healthcheckPath: visualConfig.app.healthcheckPath,
      healthcheckExpectedStatus: visualConfig.app.healthcheckExpectedStatus,
      healthcheckTimeoutSeconds: visualConfig.app.healthcheckTimeoutSeconds,
      isValid: true,
      updatedAt: value?.updatedAt,
    });
  };

  const saveYaml = () => {
    if (!validateYaml()) {
      return;
    }
    onSave({
      id: value?.id,
      dockerComposeYaml,
      backendTestYaml,
      mainServiceName: visualConfig.app.mainServiceName,
      healthcheckPath: visualConfig.app.healthcheckPath,
      healthcheckExpectedStatus: visualConfig.app.healthcheckExpectedStatus,
      healthcheckTimeoutSeconds: visualConfig.app.healthcheckTimeoutSeconds,
      isValid: true,
      updatedAt: value?.updatedAt,
    });
  };

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-md border border-border bg-page p-1">
            <button
              type="button"
              className={`focus-ring rounded px-3 py-2 text-sm font-semibold ${mode === 'config' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
              onClick={() => setMode('config')}
            >
              Config
            </button>
            <button
              type="button"
              className={`focus-ring rounded px-3 py-2 text-sm font-semibold ${mode === 'yaml' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
              onClick={() => setMode('yaml')}
            >
              YAML
            </button>
          </div>
          {value && !value.visualConfig ? (
            <Button type="button" variant="secondary" onClick={() => setMode('config')}>
              Create configurable setup
            </Button>
          ) : null}
        </div>
      </section>

      {mode === 'config' ? (
        <>
          <ConfigForm value={visualConfig} onChange={setVisualConfig} />
          {warnings.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </section>
          ) : null}
          <YamlPreview
            dockerComposeYaml={dockerComposeYaml}
            backendTestYaml={backendTestYaml}
            isCompiling={isCompiling}
            onRefresh={compile}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" disabled={isCompiling} onClick={compile}>
              <CheckCircle2 size={16} /> Validate
            </Button>
            <Button type="button" disabled={isSaving || isCompiling} onClick={saveConfig}>
              {isSaving ? 'Saving...' : 'Save configuration'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-2">
            <YamlEditor label="docker-compose.test.yml" value={dockerComposeYaml} onChange={setDockerComposeYaml} />
            <YamlEditor label="backend-test.yml" value={backendTestYaml} onChange={setBackendTestYaml} />
          </section>
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={validateYaml}>Validate YAML</Button>
            <Button type="button" disabled={isSaving} onClick={saveYaml}>{isSaving ? 'Saving...' : 'Save configuration'}</Button>
          </div>
        </>
      )}
    </form>
  );
}

interface ConfigFormProps {
  value: EnvironmentVisualConfig;
  onChange: (value: EnvironmentVisualConfig) => void;
}

function ConfigForm({ value, onChange }: ConfigFormProps) {
  const updateApp = (app: Partial<EnvironmentVisualConfig['app']>) => onChange({ ...value, app: { ...value.app, ...app } });
  const updateRun = (run: Partial<EnvironmentVisualConfig['run']>) => onChange({ ...value, run: { ...value.run, ...run } });
  const updateService = (index: number, service: EnvironmentServiceConfig) => {
    onChange({ ...value, services: value.services.map((item, itemIndex) => (itemIndex === index ? service : item)) });
  };
  const removeService = (index: number) => {
    const service = value.services[index];
    const hasDependents = value.services.some((item) => item.dependsOn?.includes(service.name));
    if (hasDependents && !window.confirm(`Remove "${service.name}"? Other services depend on it.`)) {
      return;
    }
    const services = value.services.filter((_, itemIndex) => itemIndex !== index);
    onChange({
      ...value,
      services: services.map((item) => ({ ...item, dependsOn: item.dependsOn?.filter((name) => name !== service.name) })),
      app: {
        ...value.app,
        mainServiceName: value.app.mainServiceName === service.name ? services[0]?.name ?? '' : value.app.mainServiceName,
      },
    });
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Services</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange({ ...value, services: [...value.services, createEmptyService(value.services.length + 1)] })}
          >
            <Plus size={16} /> Add service
          </Button>
        </div>
        {value.services.map((service, index) => (
          <ServiceCard
            key={`${service.name}-${index}`}
            service={service}
            allServices={value.services}
            onChange={(nextService) => updateService(index, nextService)}
            onRemove={() => removeService(index)}
          />
        ))}
      </div>

      <aside className="space-y-4">
        <section className="panel space-y-4 p-4">
          <h2 className="text-sm font-semibold text-ink">App and healthcheck</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Main API service</span>
            <select className="input" value={value.app.mainServiceName} onChange={(event) => updateApp({ mainServiceName: event.target.value })}>
              {value.services.map((service) => (
                <option key={service.name} value={service.name}>{service.name}</option>
              ))}
            </select>
          </label>
          <TextField label="Base URL" value={value.app.baseUrl} onChange={(baseUrl) => updateApp({ baseUrl })} />
          <TextField label="Healthcheck path" value={value.app.healthcheckPath} onChange={(healthcheckPath) => updateApp({ healthcheckPath })} />
          <NumberField label="Expected status" value={value.app.healthcheckExpectedStatus} onChange={(healthcheckExpectedStatus) => updateApp({ healthcheckExpectedStatus })} />
          <NumberField label="Timeout seconds" value={value.app.healthcheckTimeoutSeconds} onChange={(healthcheckTimeoutSeconds) => updateApp({ healthcheckTimeoutSeconds })} />
        </section>

        <section className="panel space-y-4 p-4">
          <h2 className="text-sm font-semibold text-ink">Run settings</h2>
          <NumberField label="Timeout minutes" value={value.run.timeoutMinutes} onChange={(timeoutMinutes) => updateRun({ timeoutMinutes })} />
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={value.run.cleanup}
              onChange={(event) => updateRun({ cleanup: event.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Cleanup environment after run
          </label>
        </section>
      </aside>
    </section>
  );
}

interface ServiceCardProps {
  service: EnvironmentServiceConfig;
  allServices: EnvironmentServiceConfig[];
  onChange: (service: EnvironmentServiceConfig) => void;
  onRemove: () => void;
}

function ServiceCard({ service, allServices, onChange, onRemove }: ServiceCardProps) {
  const update = (changes: Partial<EnvironmentServiceConfig>) => onChange({ ...service, ...changes });
  const dependencyOptions = allServices.filter((item) => item.name !== service.name);

  return (
    <article className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{service.name || 'Unnamed service'}</h3>
        <Button type="button" variant="ghost" onClick={onRemove} aria-label={`Remove ${service.name || 'service'}`}>
          <Trash2 size={16} /> Remove
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Service name" value={service.name} onChange={(name) => update({ name })} />
        <TextField label="Image" value={service.image ?? ''} onChange={(image) => update({ image })} />
        <TextField label="Build context" value={service.buildContext ?? ''} onChange={(buildContext) => update({ buildContext })} />
        <TextField label="Dockerfile" value={service.buildDockerfile ?? ''} onChange={(buildDockerfile) => update({ buildDockerfile })} />
      </div>
      <TextField label="Command" value={service.command ?? ''} onChange={(command) => update({ command })} />
      <PortsEditor value={service.ports ?? []} onChange={(ports) => update({ ports })} />
      <EnvironmentVariablesEditor value={service.environment ?? []} onChange={(environment) => update({ environment })} />
      {dependencyOptions.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Depends on</legend>
          <div className="flex flex-wrap gap-2">
            {dependencyOptions.map((option) => {
              const checked = service.dependsOn?.includes(option.name) ?? false;
              return (
                <label key={option.name} className="focus-within:ring-brand flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const current = service.dependsOn ?? [];
                      update({ dependsOn: event.target.checked ? [...current, option.name] : current.filter((name) => name !== option.name) });
                    }}
                  />
                  {option.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </article>
  );
}

function PortsEditor({ value, onChange }: { value: EnvironmentPortMapping[]; onChange: (value: EnvironmentPortMapping[]) => void }) {
  return (
    <FieldGroup title="Ports" onAdd={() => onChange([...value, { host: '', container: '' }])}>
      {value.map((port, index) => (
        <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="Host, e.g. 8000" value={port.host} onChange={(event) => onChange(updateList(value, index, { ...port, host: event.target.value }))} />
          <input className="input" placeholder="Container, e.g. 8000" value={port.container} onChange={(event) => onChange(updateList(value, index, { ...port, container: event.target.value }))} />
          <Button type="button" variant="ghost" onClick={() => onChange(removeListItem(value, index))}>Remove</Button>
        </div>
      ))}
    </FieldGroup>
  );
}

function EnvironmentVariablesEditor({ value, onChange }: { value: EnvironmentVariable[]; onChange: (value: EnvironmentVariable[]) => void }) {
  return (
    <FieldGroup title="Environment variables" onAdd={() => onChange([...value, { key: '', value: '' }])}>
      {value.map((entry, index) => (
        <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="KEY" value={entry.key} onChange={(event) => onChange(updateList(value, index, { ...entry, key: event.target.value }))} />
          <input className="input" placeholder="value" value={entry.value} onChange={(event) => onChange(updateList(value, index, { ...entry, value: event.target.value }))} />
          <Button type="button" variant="ghost" onClick={() => onChange(removeListItem(value, index))}>Remove</Button>
        </div>
      ))}
    </FieldGroup>
  );
}

function FieldGroup({ title, children, onAdd }: { title: string; children: ReactNode; onAdd: () => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        <Button type="button" variant="secondary" onClick={onAdd}>
          <Plus size={16} /> Add
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function YamlPreview({
  dockerComposeYaml,
  backendTestYaml,
  isCompiling,
  onRefresh,
}: {
  dockerComposeYaml: string;
  backendTestYaml: string;
  isCompiling: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Generated YAML preview</h2>
        <Button type="button" variant="secondary" disabled={isCompiling} onClick={onRefresh}>
          <FileCode2 size={16} /> Refresh preview
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PreviewBlock title="docker-compose.test.yml" value={dockerComposeYaml} />
        <PreviewBlock title="backend-test.yml" value={backendTestYaml} />
      </div>
    </section>
  );
}

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <article>
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted">{title}</h3>
      <pre className="max-h-80 overflow-auto rounded-md bg-code p-4 text-sm leading-6 text-code">{value || 'Preview will appear here.'}</pre>
    </article>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input className="input" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function createDefaultVisualConfig(): EnvironmentVisualConfig {
  return {
    version: '1.0',
    services: [
      {
        name: 'api',
        image: 'your-company/backend-api:latest',
        ports: [{ host: '8000', container: '8000' }],
        environment: [{ key: 'DATABASE_URL', value: 'postgres://user:pass@postgres:5432/app' }],
        dependsOn: ['postgres'],
      },
      {
        name: 'postgres',
        image: 'postgres:16',
        environment: [
          { key: 'POSTGRES_USER', value: 'user' },
          { key: 'POSTGRES_PASSWORD', value: 'pass' },
          { key: 'POSTGRES_DB', value: 'app' },
        ],
      },
    ],
    app: {
      mainServiceName: 'api',
      baseUrl: 'http://localhost:8000',
      healthcheckPath: '/health',
      healthcheckExpectedStatus: 200,
      healthcheckTimeoutSeconds: 60,
    },
    run: {
      timeoutMinutes: 10,
      cleanup: true,
    },
  };
}

function createEmptyService(index: number): EnvironmentServiceConfig {
  return {
    name: `service-${index}`,
    image: '',
    ports: [],
    environment: [],
    dependsOn: [],
  };
}

function updateList<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function removeListItem<T>(items: T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}
