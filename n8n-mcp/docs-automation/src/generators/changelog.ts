import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

export interface ChangelogOptions {
  output: string;
  from?: string;
  to?: string;
  preset?: string;
  releaseCount?: number;
  includeBreaking?: boolean;
  groupBy?: 'type' | 'scope';
}

interface Commit {
  hash: string;
  date: string;
  message: string;
  body: string;
  type?: string;
  scope?: string;
  breaking?: boolean;
  footer?: string;
}

interface Release {
  version: string;
  date: string;
  commits: Commit[];
}

export class ChangelogGenerator {
  private readonly typeMapping: Record<string, string> = {
    feat: '✨ Features',
    fix: '🐛 Bug Fixes',
    docs: '📚 Documentation',
    style: '💎 Styles',
    refactor: '♻️ Code Refactoring',
    perf: '🚀 Performance Improvements',
    test: '✅ Tests',
    build: '📦 Build System',
    ci: '🎡 Continuous Integration',
    chore: '♻️ Chores',
    revert: '🗑 Reverts'
  };

  async generate(options: ChangelogOptions): Promise<void> {
    const spinner = ora('Generating changelog...').start();
    
    try {
      // Get git tags for releases
      const releases = await this.getReleases(options);
      
      spinner.text = 'Parsing commits...';
      
      // Parse commits for each release
      for (const release of releases) {
        release.commits = await this.getCommits(release.version, options);
      }
      
      spinner.text = 'Formatting changelog...';
      
      // Generate changelog content
      const content = this.formatChangelog(releases, options);
      
      // Write changelog
      await fs.writeFile(options.output, content);
      
      spinner.succeed('Changelog generated');
    } catch (error) {
      spinner.fail('Failed to generate changelog');
      throw error;
    }
  }

  async generateFromConfig(configFile: string): Promise<void> {
    const config = JSON.parse(await fs.readFile(configFile, 'utf-8'));
    await this.generate(config.changelog);
  }

  private async getReleases(options: ChangelogOptions): Promise<Release[]> {
    const releases: Release[] = [];
    
    try {
      // Get all tags
      const { stdout: tagsOutput } = await execAsync('git tag --sort=-version:refname');
      const tags = tagsOutput.trim().split('\n').filter(Boolean);
      
      if (tags.length === 0) {
        // No tags, use current commit as unreleased
        releases.push({
          version: 'Unreleased',
          date: new Date().toISOString().split('T')[0],
          commits: []
        });
      } else {
        // Add unreleased section if there are commits after the last tag
        const { stdout: unreleasedCount } = await execAsync(`git rev-list ${tags[0]}..HEAD --count`);
        if (parseInt(unreleasedCount) > 0) {
          releases.push({
            version: 'Unreleased',
            date: new Date().toISOString().split('T')[0],
            commits: []
          });
        }
        
        // Add tagged releases
        const limit = options.releaseCount || tags.length;
        for (let i = 0; i < Math.min(limit, tags.length); i++) {
          const tag = tags[i];
          const { stdout: tagDate } = await execAsync(`git log -1 --format=%ai ${tag}`);
          
          releases.push({
            version: tag,
            date: tagDate.trim().split(' ')[0],
            commits: []
          });
        }
      }
      
      return releases;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not get git tags, using single release'));
      return [{
        version: 'Unreleased',
        date: new Date().toISOString().split('T')[0],
        commits: []
      }];
    }
  }

  private async getCommits(version: string, options: ChangelogOptions): Promise<Commit[]> {
    let range: string;
    
    if (version === 'Unreleased') {
      // Get commits since last tag
      try {
        const { stdout: lastTag } = await execAsync('git describe --tags --abbrev=0');
        range = `${lastTag.trim()}..HEAD`;
      } catch {
        // No tags, get all commits
        range = options.from ? `${options.from}..HEAD` : 'HEAD';
      }
    } else {
      // Get commits for this tag
      try {
        const { stdout: tags } = await execAsync('git tag --sort=-version:refname');
        const tagList = tags.trim().split('\n');
        const currentIndex = tagList.indexOf(version);
        
        if (currentIndex === tagList.length - 1) {
          // First release
          range = version;
        } else {
          // Between two tags
          const previousTag = tagList[currentIndex + 1];
          range = `${previousTag}..${version}`;
        }
      } catch {
        range = version;
      }
    }
    
    // Get commits
    const format = '%H|%ai|%s|%b|%-';
    const { stdout } = await execAsync(`git log ${range} --format="${format}"`);
    
    const commits: Commit[] = [];
    const commitStrings = stdout.trim().split('|%-').filter(Boolean);
    
    for (const commitString of commitStrings) {
      const [hash, date, message, ...bodyParts] = commitString.split('|');
      const body = bodyParts.join('|').trim();
      
      const commit: Commit = {
        hash: hash.substring(0, 7),
        date: date.split(' ')[0],
        message,
        body
      };
      
      // Parse conventional commit
      const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?: (.+)/);
      if (conventionalMatch) {
        commit.type = conventionalMatch[1];
        commit.scope = conventionalMatch[2];
        commit.message = conventionalMatch[3];
      }
      
      // Check for breaking changes
      if (message.includes('!:') || body.includes('BREAKING CHANGE:')) {
        commit.breaking = true;
      }
      
      // Extract footer (e.g., closes #123)
      const footerMatch = body.match(/(?:Closes?|Fixes?|Resolves?):?\s*(#\d+)/i);
      if (footerMatch) {
        commit.footer = footerMatch[0];
      }
      
      commits.push(commit);
    }
    
    return commits;
  }

  private formatChangelog(releases: Release[], options: ChangelogOptions): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# Changelog\n');
    lines.push('All notable changes to this project will be documented in this file.\n');
    lines.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),');
    lines.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n');
    
    // Releases
    for (const release of releases) {
      if (release.commits.length === 0) continue;
      
      // Release header
      if (release.version === 'Unreleased') {
        lines.push(`## [Unreleased]`);
      } else {
        lines.push(`## [${release.version}] - ${release.date}`);
      }
      lines.push('');
      
      // Group commits
      const groups = this.groupCommits(release.commits, options.groupBy || 'type');
      
      // Breaking changes first
      const breakingChanges = release.commits.filter(c => c.breaking);
      if (breakingChanges.length > 0) {
        lines.push('### ⚠️ BREAKING CHANGES\n');
        for (const commit of breakingChanges) {
          lines.push(`- ${this.formatCommit(commit)}`);
        }
        lines.push('');
      }
      
      // Other changes by type
      for (const [group, commits] of Object.entries(groups)) {
        if (commits.length === 0) continue;
        
        const groupTitle = this.typeMapping[group] || group;
        lines.push(`### ${groupTitle}\n`);
        
        for (const commit of commits) {
          if (!commit.breaking) {
            lines.push(`- ${this.formatCommit(commit)}`);
          }
        }
        lines.push('');
      }
    }
    
    // Footer with links
    lines.push('\n---\n');
    lines.push('## Links\n');
    
    for (let i = 0; i < releases.length; i++) {
      const release = releases[i];
      if (release.version === 'Unreleased') {
        if (releases.length > 1) {
          lines.push(`[Unreleased]: https://github.com/owner/repo/compare/${releases[1].version}...HEAD`);
        }
      } else if (i < releases.length - 1) {
        const previousRelease = releases[i + 1];
        if (previousRelease.version !== 'Unreleased') {
          lines.push(`[${release.version}]: https://github.com/owner/repo/compare/${previousRelease.version}...${release.version}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  private groupCommits(commits: Commit[], groupBy: 'type' | 'scope'): Record<string, Commit[]> {
    const groups: Record<string, Commit[]> = {};
    
    for (const commit of commits) {
      const key = groupBy === 'type' ? (commit.type || 'other') : (commit.scope || 'general');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(commit);
    }
    
    // Sort groups by priority
    const sortedGroups: Record<string, Commit[]> = {};
    const priority = ['feat', 'fix', 'perf', 'refactor', 'docs', 'style', 'test', 'build', 'ci', 'chore', 'revert'];
    
    for (const type of priority) {
      if (groups[type]) {
        sortedGroups[type] = groups[type];
      }
    }
    
    // Add remaining groups
    for (const [key, commits] of Object.entries(groups)) {
      if (!sortedGroups[key]) {
        sortedGroups[key] = commits;
      }
    }
    
    return sortedGroups;
  }

  private formatCommit(commit: Commit): string {
    let message = commit.message;
    
    // Add scope if present
    if (commit.scope) {
      message = `**${commit.scope}**: ${message}`;
    }
    
    // Add commit hash
    message += ` ([${commit.hash}](https://github.com/owner/repo/commit/${commit.hash}))`;
    
    // Add footer (issue references)
    if (commit.footer) {
      message += ` - ${commit.footer}`;
    }
    
    return message;
  }

  async generateReleaseNotes(version: string, options?: Partial<ChangelogOptions>): Promise<string> {
    const commits = await this.getCommits(version, options || {});
    
    const lines: string[] = [];
    lines.push(`# Release Notes - ${version}\n`);
    
    // Summary
    const features = commits.filter(c => c.type === 'feat').length;
    const fixes = commits.filter(c => c.type === 'fix').length;
    const breaking = commits.filter(c => c.breaking).length;
    
    lines.push('## Summary\n');
    lines.push(`This release includes ${features} new features, ${fixes} bug fixes, and ${breaking} breaking changes.\n`);
    
    // Highlights
    const highlights = commits.filter(c => c.type === 'feat' || c.breaking);
    if (highlights.length > 0) {
      lines.push('## Highlights\n');
      for (const commit of highlights.slice(0, 5)) {
        lines.push(`- ${this.formatCommit(commit)}`);
      }
      lines.push('');
    }
    
    // Full changelog section
    lines.push('## Changes\n');
    const groups = this.groupCommits(commits, 'type');
    
    for (const [type, typeCommits] of Object.entries(groups)) {
      const title = this.typeMapping[type] || type;
      lines.push(`### ${title}\n`);
      
      for (const commit of typeCommits) {
        lines.push(`- ${this.formatCommit(commit)}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
}