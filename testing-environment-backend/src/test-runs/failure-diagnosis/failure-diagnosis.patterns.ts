export const PORT_CONFLICT_PATTERN =
  /port is already allocated|address already in use|Bind for|ports are not available/i;

export const CONTAINER_EXIT_PATTERN =
  /failed with code \d+|exited \(?\d+\)?|container .* exited|non-zero exit/i;

export const IMAGE_PULL_PATTERN = /pull|image pull|manifest unknown|repository does not exist/i;

export const NETWORK_PATTERN =
  /network|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|ECONNRESET|fetch failed/i;

export const TIMEOUT_PATTERN = /timeout|timed out|aborted|AbortError/i;

export const VARIABLE_EXTRACTION_PATTERN =
  /variable|jsonpath|path not found|undefined variable|failed to extract/i;

export function extractPortFromMessage(message: string): string | undefined {
  const bindMatch = message.match(/Bind for [\d.]+:(\d+)/i);
  if (bindMatch) {
    return bindMatch[1];
  }
  const portMatch = message.match(/port (\d+)/i);
  return portMatch?.[1];
}

export function extractExitCode(message: string): string | undefined {
  const containerMatch =
    message.match(/exited \((\d+)\)/i) ?? message.match(/exited with code (\d+)/i);
  if (containerMatch) {
    return containerMatch[1];
  }
  const codeMatch = message.match(/failed with code (\d+)/i);
  return codeMatch?.[1];
}
