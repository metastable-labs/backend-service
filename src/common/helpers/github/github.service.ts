import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/core';
import { App } from 'octokit';
import { env } from '../../config/env';
import {
  EthereumOptimism,
  GitHubFileContentResponse,
  Installation,
  SuperBridgeApp,
} from './interface/github.interface';
import { installations } from './constants/github';
import { InstallationName } from './enums/github.enum';
import {
  Migrate,
  PullRequest,
} from '../../../modules/migration/interfaces/migration.interface';
import { PrStatus } from '../../../modules/migration/enums/migration.enum';
import { GithubAuth } from '../../../modules/shared/interfaces/shared.interface';

@Injectable()
export class GithubService {
  private app: App;
  constructor(private readonly httpService: HttpService) {
    this.app = new App({
      appId: env.github.appId,
      privateKey: env.github.appPrivateKey.replace(/\\n/g, '\n'),
    });
  }

  async getUserByAuthCode(code: string) {
    try {
      const response = await this.httpService.axiosRef.post(
        `${env.github.url}/login/oauth/access_token`,
        {
          client_id: env.github.clientId,
          client_secret: env.github.clientSecret,
          code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      const octokit = new Octokit({ auth: response.data.access_token });
      const user = await octokit.request('GET /user');

      return {
        status: true,
        data: user.data,
        auth: response.data as GithubAuth,
      };
    } catch (error) {
      return {
        status: false,
        message: error.message,
      };
    }
  }

  async migrateData(
    data: Migrate,
    username: string,
    logoUrl: string,
    file?: Express.Multer.File,
  ) {
    try {
      let formattedInstallations = installations;

      if (data.isSuperbridge) {
        formattedInstallations = installations.filter(
          (installation) =>
            installation.owner === InstallationName.SUPERBRIDGEAPP,
        );
      }

      const results = await this.processInstallations(
        formattedInstallations,
        data,
        username,
        logoUrl,
        file,
      );

      const filteredResults = results.filter((result) => result !== undefined);
      return {
        status: true,
        data: filteredResults as PullRequest[] | [],
      };
    } catch (error) {
      return {
        status: false,
        error: error.message,
      };
    }
  }

  async getPullRequest(pullRequests: PullRequest[]) {
    try {
      const prs = pullRequests.map((pullRequest) =>
        this.isPullRequestMerged(pullRequest, installations),
      );

      return Promise.all(prs);
    } catch (error) {
      return pullRequests;
    }
  }

  private async isPullRequestMerged(
    pullRequest: PullRequest,
    installations: Installation[],
  ) {
    try {
      const installation = installations.find(
        (install) => install.id === pullRequest.installation_id,
      );

      if (!installation) {
        return;
      }

      const octokit = await this.getInstallationInstance(
        pullRequest.installation_id,
      );

      if (!octokit) {
        return;
      }

      const res = await octokit.request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}',
        {
          owner: installation.owner,
          repo: installation.repo,
          pull_number: pullRequest.id,
        },
      );

      let status = PrStatus.OPEN;

      if (res.data.merged_at) {
        status = PrStatus.MERGED;
      } else if (res.data.closed_at) {
        status = PrStatus.CLOSED;
      }

      return {
        ...pullRequest,
        status,
      };
    } catch (error) {
      return pullRequest;
    }
  }

  private async processInstallations(
    installations: Installation[],
    data: Migrate,
    username: string,
    logoUrl: string,
    file?: Express.Multer.File,
  ) {
    const promises = installations.map((installation) =>
      this.processInstallation(installation, data, username, logoUrl, file),
    );

    return Promise.all(promises);
  }

  private async processInstallation(
    installation: Installation,
    data: Migrate,
    username: string,
    logoUrl: string,
    file?: Express.Multer.File,
  ) {
    if (!installation.active) {
      return;
    }

    const octokit = await this.getInstallationInstance(Number(installation.id));

    if (!octokit) {
      return;
    }

    const chainsLength = data.chains.length;
    const l2Chain = data.chains[chainsLength - 1];

    const owner = installation.owner;
    const repo = installation.repo;
    const path = `data/${data.symbol}/data.json`;
    const message = `${data.symbol} ${l2Chain.name} data.json`;
    const newBranchName = `add-${data.symbol}`.toLowerCase();
    const baseBranchName = installation.defaultBranch;
    const title = `Add ${data.symbol} to ${installation.category}`;
    let body = `Adding ${data.symbol} to ${installation.category} token list repo. Tagging @${username} for verification`;

    const isBaseChain = data.chains.some((chain) =>
      chain.name.includes('base'),
    );
    const isZoraChain = data.chains.some((chain) =>
      chain.name.includes('zora'),
    );

    if (
      installation.owner === InstallationName.ETHEREUM_OPTIMISM &&
      isBaseChain
    ) {
      body = `Adding ${data.symbol} to the superchain token list repo. Tagging @${username} for verification\n\n cc @cb-fluke @taycaldwell @wbnns`;
    } else if (
      installation.owner === InstallationName.ETHEREUM_OPTIMISM &&
      isZoraChain
    ) {
      body = `Adding ${data.symbol} to the superchain token list repo. Tagging @${username} for verification\n\n cc @tbtstl`;
    }

    const content = await this.getContent(
      owner,
      octokit,
      installation,
      newBranchName,
      path,
      data,
      logoUrl,
    );

    await this.createNewBranchFromDefault(
      octokit,
      newBranchName,
      baseBranchName,
      owner,
      repo,
    );

    await this.createOrUpdateFile(
      octokit,
      owner,
      repo,
      newBranchName,
      path,
      content,
      message,
    );

    if (installation.owner === InstallationName.ETHEREUM_OPTIMISM && file) {
      const logoPath = `data/${data.symbol}/logo.svg`;
      const logoMessage = `${data.symbol} logo.svg`;
      const logoContent = Buffer.from(file.buffer).toString('base64');

      await this.createOrUpdateFile(
        octokit,
        owner,
        repo,
        newBranchName,
        logoPath,
        logoContent,
        logoMessage,
      );
    }

    const response = await this.createPullRequest(
      octokit,
      owner,
      repo,
      baseBranchName,
      newBranchName,
      title,
      body,
    );

    return {
      ...response,
      repo: installation.repo,
      owner: installation.owner,
      chain: l2Chain.name,
      installation_id: installation.id,
    };
  }

  private async getContent(
    name: string,
    octokit: Octokit,
    installation: Installation,
    branch: string,
    path: string,
    data: Migrate,
    logoUrl: string,
  ) {
    if (name === InstallationName.ETHEREUM_OPTIMISM) {
      const content = await this.getSuperchainContent(
        octokit,
        installation,
        branch,
        path,
        data,
      );

      const contentBase64 = Buffer.from(
        JSON.stringify(content, null, 2),
      ).toString('base64');

      return contentBase64;
    } else if (name === InstallationName.SUPERBRIDGEAPP) {
      const content = await this.getSuperbridgeAppContent(
        octokit,
        installation,
        branch,
        path,
        data,
        logoUrl,
      );

      const contentBase64 = Buffer.from(
        JSON.stringify(content, null, 2),
      ).toString('base64');

      return contentBase64;
    } else {
      const superbridgeAppContent = await this.getSuperbridgeAppContent(
        octokit,
        installation,
        branch,
        path,
        data,
        logoUrl,
      );

      const superchainContent = await this.getSuperchainContent(
        octokit,
        installation,
        branch,
        path,
        data,
      );

      const content = {
        superchain: superchainContent,
        superbridge: superbridgeAppContent,
      };

      const contentBase64 = Buffer.from(
        JSON.stringify(content, null, 2),
      ).toString('base64');

      return contentBase64;
    }
  }

  private async getSuperbridgeAppContent(
    octokit: Octokit,
    installation: Installation,
    branch: string,
    path: string,
    data: Migrate,
    logoUrl: string,
  ) {
    let content: SuperBridgeApp = {
      name: data.name,
      symbol: data.symbol,
      decimals: Number(data.decimals),
      description: data.description,
      website: data.website,
      twitter: data.twitter,
      logoURI: logoUrl,
      opTokenId: data.symbol,
      addresses: {},
    };

    const addresses = data.chains.map((chain) => {
      const token = {
        [chain.id]: chain.token_address,
      };

      if (chain.token_detail_override) {
        content = {
          ...content,
          ...chain.token_detail_override,
          opTokenId: chain.token_detail_override.symbol ?? data.symbol,
        };
      }

      return token;
    });

    addresses.forEach((address) => {
      content.addresses = {
        ...content.addresses,
        ...address,
      };
    });

    const defaultBranchRes = await this.getFileSHA(
      octokit,
      installation.owner,
      installation.repo,
      installation.defaultBranch,
      path,
    );

    const newBranchRes = await this.getFileSHA(
      octokit,
      installation.owner,
      installation.repo,
      branch,
      path,
    );

    if (!defaultBranchRes && !newBranchRes) {
      return content;
    }

    let currentData = content;

    if (defaultBranchRes?.content) {
      const contentDecoded = Buffer.from(
        defaultBranchRes.content,
        'base64',
      ).toString('utf8');

      const parsedSurrentData = JSON.parse(contentDecoded);

      currentData = parsedSurrentData.superbridge ?? parsedSurrentData;
    }

    if (newBranchRes?.content) {
      const contentDecoded = Buffer.from(
        newBranchRes.content,
        'base64',
      ).toString('utf8');

      const parsedSurrentData = JSON.parse(contentDecoded);

      currentData = parsedSurrentData.superbridge ?? parsedSurrentData;
    }

    const mergedContent: SuperBridgeApp = {
      ...currentData,
      ...content,
      addresses: {
        ...currentData.addresses,
        ...content.addresses,
      },
    };

    return mergedContent;
  }

  private async getSuperchainContent(
    octokit: Octokit,
    installation: Installation,
    branch: string,
    path: string,
    data: Migrate,
  ) {
    const content: EthereumOptimism = {
      name: data.name,
      symbol: data.symbol,
      decimals: Number(data.decimals),
      description: data.description,
      website: data.website,
      twitter: data.twitter,
      tokens: {},
    };

    const tokens = data.chains.map((chain) => {
      const token = {
        [chain.name]: {
          address: chain.token_address,
          overrides: chain.token_detail_override || undefined,
        },
      };

      return token;
    });

    tokens.forEach((token) => {
      content.tokens = {
        ...content.tokens,
        ...token,
      };
    });

    const defaultBranchRes = await this.getFileSHA(
      octokit,
      installation.owner,
      installation.repo,
      installation.defaultBranch,
      path,
    );

    const newBranchRes = await this.getFileSHA(
      octokit,
      installation.owner,
      installation.repo,
      branch,
      path,
    );

    if (!defaultBranchRes && !newBranchRes) {
      return content;
    }

    let currentData = content;

    if (defaultBranchRes?.content) {
      const contentDecoded = Buffer.from(
        defaultBranchRes.content,
        'base64',
      ).toString('utf8');

      const parsedCurrentData = JSON.parse(contentDecoded);

      currentData = parsedCurrentData.superchain ?? parsedCurrentData;
    }

    if (newBranchRes?.content) {
      const contentDecoded = Buffer.from(
        newBranchRes.content,
        'base64',
      ).toString('utf8');

      const parsedCurrentData = JSON.parse(contentDecoded);

      currentData = parsedCurrentData.superchain ?? parsedCurrentData;
    }

    const mergedContent: EthereumOptimism = {
      ...currentData,
      ...content,
      tokens: {
        ...currentData.tokens,
        ...content.tokens,
      },
    };

    return mergedContent;
  }

  private async getInstallationInstance(
    installationId: number,
  ): Promise<Octokit | null> {
    try {
      const octokit = await this.app.getInstallationOctokit(installationId);

      return octokit;
    } catch (error) {
      return null;
    }
  }

  private async getFileSHA(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<GitHubFileContentResponse | null> {
    try {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        {
          owner,
          repo,
          path,
          ref: branch,
        },
      );

      return response.data as GitHubFileContentResponse;
    } catch (error) {
      return null;
    }
  }

  private async branchExists(
    octokit: Octokit,
    owner: string,
    repo: string,
    branchName: string,
  ) {
    try {
      const response = await octokit.request(
        'GET /repos/{owner}/{repo}/branches/{branch}',
        {
          owner,
          repo,
          branch: branchName,
        },
      );

      return response.data;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }

      return false;
    }
  }

  private async createOrUpdateFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string,
  ) {
    const res = await this.getFileSHA(octokit, owner, repo, branch, path);

    const response = await octokit.request(
      'PUT /repos/{owner}/{repo}/contents/{path}',
      {
        owner,
        repo,
        branch,
        path,
        message: res ? `Updated ${message}` : `Added ${message}`,
        content,
        sha: res ? res.sha : undefined,
      },
    );
    return response.data;
  }

  private async createNewBranchFromDefault(
    octokit: Octokit,
    newBranchName: string,
    baseBranchName: string,
    owner: string,
    repo: string,
  ) {
    const baseBranchResponse = await this.branchExists(
      octokit,
      owner,
      repo,
      baseBranchName,
    );

    let sha;
    if (baseBranchResponse && baseBranchResponse.commit.sha) {
      sha = baseBranchResponse.commit.sha;
    }

    const newBranchResponse = await this.branchExists(
      octokit,
      owner,
      repo,
      newBranchName,
    );

    if (newBranchResponse !== false) {
      return newBranchResponse;
    }

    const response = await octokit.request(
      'POST /repos/{owner}/{repo}/git/refs',
      {
        owner,
        repo: repo,
        ref: `refs/heads/${newBranchName}`,
        sha: sha as string,
      },
    );

    return response.data;
  }

  private async createPullRequest(
    octokit: Octokit,
    owner: string,
    repo: string,
    base: string,
    head: string,
    title: string,
    body: string,
  ) {
    try {
      const response = await octokit.request(
        'POST /repos/{owner}/{repo}/pulls',
        {
          owner,
          repo,
          title,
          body,
          head,
          base,
        },
      );

      return {
        id: response.data.number,
        url: response.data.html_url,
        status: PrStatus.OPEN,
      };
    } catch (error) {
      return;
    }
  }
}
