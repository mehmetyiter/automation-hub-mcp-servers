import { WorkflowPattern } from './index';

export const socialMediaPatterns: WorkflowPattern[] = [
  {
    id: 'content-distribution-hub',
    name: 'Multi-Platform Content Distribution',
    description: 'Automatically distribute content across multiple social media platforms with scheduling and optimization',
    keywords: ['social', 'media', 'content', 'distribution', 'post', 'schedule', 'twitter', 'linkedin', 'facebook', 'instagram'],
    category: 'social-media',
    difficulty: 'intermediate',
    requiredServices: ['social-media', 'content-management', 'analytics'],
    examples: [
      'Post content to all social media platforms at once',
      'Schedule posts across Twitter, LinkedIn, and Facebook',
      'Distribute blog posts to social media automatically'
    ],
    tags: ['marketing', 'content', 'scheduling', 'automation'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'content_trigger',
            name: 'New Content Trigger',
            type: 'n8n-nodes-base.webhook',
            position: [250, 300],
            parameters: {
              path: 'new-content',
              responseMode: 'onReceived'
            }
          },
          {
            id: 'format_content',
            name: 'Format for Platforms',
            type: 'n8n-nodes-base.code',
            position: [450, 300],
            parameters: {
              jsCode: `
                const content = items[0].json;
                const platforms = [];
                
                // Twitter format (280 chars)
                platforms.push({
                  platform: 'twitter',
                  text: content.title.substring(0, 250) + '... ' + content.link + ' #blog',
                  media: content.featuredImage
                });
                
                // LinkedIn format
                platforms.push({
                  platform: 'linkedin',
                  text: content.title + '\\n\\n' + content.excerpt + '\\n\\nRead more: ' + content.link,
                  media: content.featuredImage
                });
                
                // Facebook format
                platforms.push({
                  platform: 'facebook',
                  text: content.title + '\\n\\n' + content.excerpt,
                  link: content.link,
                  media: content.featuredImage
                });
                
                return platforms.map(p => ({ json: p }));
              `
            }
          },
          {
            id: 'twitter_post',
            name: 'Post to Twitter',
            type: 'n8n-nodes-base.twitter',
            position: [650, 200],
            parameters: {
              text: '={{$json["text"]}}',
              additionalFields: {
                attachments: '={{$json["media"]}}'
              }
            }
          },
          {
            id: 'linkedin_post',
            name: 'Post to LinkedIn',
            type: 'n8n-nodes-base.linkedIn',
            position: [650, 300],
            parameters: {
              text: '={{$json["text"]}}',
              shareMediaCategory: 'ARTICLE',
              additionalFields: {
                visibility: 'PUBLIC'
              }
            }
          },
          {
            id: 'facebook_post',
            name: 'Post to Facebook',
            type: 'n8n-nodes-base.facebook',
            position: [650, 400],
            parameters: {
              resource: 'post',
              operation: 'create',
              pageId: '{{$env.FACEBOOK_PAGE_ID}}',
              message: '={{$json["text"]}}',
              additionalFields: {
                link: '={{$json["link"]}}'
              }
            }
          },
          {
            id: 'log_results',
            name: 'Log Results',
            type: 'n8n-nodes-base.set',
            position: [850, 300],
            parameters: {
              values: {
                string: [
                  {
                    name: 'status',
                    value: 'Content distributed successfully'
                  }
                ]
              }
            }
          }
        ],
        connections: {
          'New Content Trigger': {
            main: [[{ node: 'Format for Platforms', type: 'main', index: 0 }]]
          },
          'Format for Platforms': {
            main: [[
              { node: 'Twitter Post', type: 'main', index: 0 },
              { node: 'LinkedIn Post', type: 'main', index: 0 },
              { node: 'Facebook Post', type: 'main', index: 0 }
            ]]
          },
          'Twitter Post': {
            main: [[{ node: 'Log Results', type: 'main', index: 0 }]]
          },
          'LinkedIn Post': {
            main: [[{ node: 'Log Results', type: 'main', index: 0 }]]
          },
          'Facebook Post': {
            main: [[{ node: 'Log Results', type: 'main', index: 0 }]]
          }
        }
      },
      make: {
        scenario: {
          name: 'Content Distribution Hub',
          modules: [
            {
              id: 1,
              type: 'webhook',
              name: 'Content Webhook'
            },
            {
              id: 2,
              type: 'router',
              name: 'Platform Router',
              routes: [
                { filter: 'twitter', targetModule: 3 },
                { filter: 'linkedin', targetModule: 4 },
                { filter: 'facebook', targetModule: 5 }
              ]
            },
            {
              id: 3,
              type: 'twitter',
              name: 'Post to Twitter'
            },
            {
              id: 4,
              type: 'linkedin',
              name: 'Post to LinkedIn'
            },
            {
              id: 5,
              type: 'facebook',
              name: 'Post to Facebook'
            }
          ]
        }
      }
    }
  },
  {
    id: 'social-media-monitoring',
    name: 'Social Media Monitoring & Response',
    description: 'Monitor social media mentions and automatically respond or escalate',
    keywords: ['monitor', 'social', 'media', 'mentions', 'response', 'sentiment', 'alert'],
    category: 'social-media',
    difficulty: 'complex',
    requiredServices: ['social-media', 'ai', 'notification'],
    examples: [
      'Monitor Twitter for brand mentions and respond automatically',
      'Track social media sentiment and alert on negative feedback',
      'Automate social media customer service responses'
    ],
    tags: ['monitoring', 'sentiment', 'customer-service', 'alerts'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'twitter_stream',
            name: 'Twitter Stream',
            type: 'n8n-nodes-base.twitterTrigger',
            position: [250, 300],
            parameters: {
              rule: '{{$env.BRAND_NAME}} OR @{{$env.TWITTER_HANDLE}}'
            }
          },
          {
            id: 'sentiment_analysis',
            name: 'Analyze Sentiment',
            type: 'n8n-nodes-base.openAi',
            position: [450, 300],
            parameters: {
              resource: 'chat',
              model: 'gpt-4',
              messages: {
                values: [
                  {
                    role: 'system',
                    content: 'Analyze the sentiment of this tweet. Return: positive, neutral, or negative. Also return a confidence score 0-100.'
                  },
                  {
                    role: 'user',
                    content: '={{$json["text"]}}'
                  }
                ]
              }
            }
          },
          {
            id: 'route_by_sentiment',
            name: 'Route by Sentiment',
            type: 'n8n-nodes-base.switch',
            position: [650, 300],
            parameters: {
              dataType: 'string',
              value1: '={{$json["sentiment"]}}',
              rules: {
                rules: [
                  { value2: 'positive', output: 0 },
                  { value2: 'neutral', output: 1 },
                  { value2: 'negative', output: 2 }
                ]
              }
            }
          },
          {
            id: 'positive_response',
            name: 'Thank Customer',
            type: 'n8n-nodes-base.twitter',
            position: [850, 200],
            parameters: {
              text: 'Thank you for your kind words! We appreciate your support 💙',
              additionalFields: {
                inReplyToStatusId: '={{$json["id"]}}'
              }
            }
          },
          {
            id: 'negative_alert',
            name: 'Alert Support Team',
            type: 'n8n-nodes-base.slack',
            position: [850, 400],
            parameters: {
              channel: '#social-support',
              text: '🚨 Negative mention detected!\n\nUser: {{$json["user"]["screen_name"]}}\nTweet: {{$json["text"]}}\nSentiment Score: {{$json["sentimentScore"]}}\n\nPlease respond ASAP!'
            }
          }
        ]
      }
    }
  },
  {
    id: 'influencer-outreach',
    name: 'Automated Influencer Outreach Campaign',
    description: 'Find and reach out to relevant influencers with personalized messages',
    keywords: ['influencer', 'outreach', 'campaign', 'social', 'media', 'marketing'],
    category: 'social-media',
    difficulty: 'complex',
    requiredServices: ['social-media', 'email', 'crm', 'analytics'],
    examples: [
      'Find Instagram influencers in my niche and send collaboration proposals',
      'Automate influencer outreach with personalized messages',
      'Track influencer campaign performance'
    ],
    tags: ['influencer-marketing', 'outreach', 'campaigns'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'search_influencers',
            name: 'Search Influencers',
            type: 'n8n-nodes-base.httpRequest',
            position: [250, 300],
            parameters: {
              method: 'GET',
              url: 'https://api.instagram.com/v1/users/search',
              queryParameters: {
                parameters: [
                  { name: 'q', value: '{{$env.NICHE_KEYWORDS}}' },
                  { name: 'count', value: '50' }
                ]
              }
            }
          },
          {
            id: 'filter_by_followers',
            name: 'Filter by Followers',
            type: 'n8n-nodes-base.filter',
            position: [450, 300],
            parameters: {
              conditions: {
                number: [
                  {
                    value1: '={{$json["follower_count"]}}',
                    operation: 'largerEqual',
                    value2: 10000
                  },
                  {
                    value1: '={{$json["follower_count"]}}',
                    operation: 'smallerEqual',
                    value2: 500000
                  }
                ]
              }
            }
          },
          {
            id: 'calculate_engagement',
            name: 'Calculate Engagement',
            type: 'n8n-nodes-base.code',
            position: [650, 300],
            parameters: {
              jsCode: `
                const influencer = items[0].json;
                const posts = influencer.recent_posts || [];
                
                let totalEngagement = 0;
                posts.forEach(post => {
                  totalEngagement += post.likes + post.comments;
                });
                
                const avgEngagement = posts.length > 0 ? totalEngagement / posts.length : 0;
                const engagementRate = (avgEngagement / influencer.follower_count) * 100;
                
                return [{
                  json: {
                    ...influencer,
                    engagementRate: engagementRate.toFixed(2),
                    qualityScore: engagementRate > 3 ? 'high' : engagementRate > 1 ? 'medium' : 'low'
                  }
                }];
              `
            }
          },
          {
            id: 'personalize_outreach',
            name: 'Generate Personalized Message',
            type: 'n8n-nodes-base.openAi',
            position: [850, 300],
            parameters: {
              resource: 'chat',
              model: 'gpt-4',
              messages: {
                values: [
                  {
                    role: 'system',
                    content: 'Create a personalized influencer outreach message. Be professional but friendly. Mention specific content they\'ve created.'
                  },
                  {
                    role: 'user',
                    content: 'Influencer: {{$json["username"]}}\nNiche: {{$json["niche"]}}\nFollowers: {{$json["follower_count"]}}\nRecent post: {{$json["recent_posts"][0]["caption"]}}'
                  }
                ]
              }
            }
          },
          {
            id: 'send_outreach',
            name: 'Send Outreach Email',
            type: 'n8n-nodes-base.emailSend',
            position: [1050, 300],
            parameters: {
              fromEmail: '{{$env.COMPANY_EMAIL}}',
              toEmail: '={{$json["email"]}}',
              subject: 'Collaboration Opportunity with {{$env.BRAND_NAME}}',
              emailType: 'html',
              message: '={{$json["choices"][0]["message"]["content"]}}'
            }
          },
          {
            id: 'add_to_crm',
            name: 'Track in CRM',
            type: 'n8n-nodes-base.hubspot',
            position: [1250, 300],
            parameters: {
              resource: 'contact',
              operation: 'create',
              additionalFields: {
                email: '={{$json["email"]}}',
                firstname: '={{$json["name"]}}',
                instagram_handle: '={{$json["username"]}}',
                follower_count: '={{$json["follower_count"]}}',
                engagement_rate: '={{$json["engagementRate"]}}',
                lead_status: 'CONTACTED'
              }
            }
          }
        ]
      }
    }
  },
  {
    id: 'content-repurposing',
    name: 'Automated Content Repurposing',
    description: 'Transform long-form content into multiple social media formats',
    keywords: ['content', 'repurpose', 'transform', 'social', 'media', 'video', 'blog'],
    category: 'social-media',
    difficulty: 'intermediate',
    requiredServices: ['content-management', 'ai', 'social-media'],
    examples: [
      'Turn blog posts into Twitter threads and LinkedIn articles',
      'Convert YouTube videos into Instagram reels and TikToks',
      'Transform podcasts into social media snippets'
    ],
    tags: ['content', 'repurposing', 'automation'],
    platforms: {
      n8n: {
        nodes: [
          {
            id: 'content_source',
            name: 'New Blog Post',
            type: 'n8n-nodes-base.rssFeedRead',
            position: [250, 300],
            parameters: {
              url: '{{$env.BLOG_RSS_FEED}}'
            }
          },
          {
            id: 'extract_content',
            name: 'Extract Content',
            type: 'n8n-nodes-base.htmlExtract',
            position: [450, 300],
            parameters: {
              url: '={{$json["link"]}}',
              values: {
                values: [
                  { key: 'title', cssSelector: 'h1' },
                  { key: 'content', cssSelector: '.post-content' },
                  { key: 'image', cssSelector: 'img', attribute: 'src' }
                ]
              }
            }
          },
          {
            id: 'generate_formats',
            name: 'Generate Social Formats',
            type: 'n8n-nodes-base.openAi',
            position: [650, 300],
            parameters: {
              resource: 'chat',
              model: 'gpt-4',
              messages: {
                values: [
                  {
                    role: 'system',
                    content: `Transform this blog post into:
                      1. A Twitter thread (5-7 tweets)
                      2. A LinkedIn post (300 words)
                      3. An Instagram caption (150 words)
                      4. A Facebook post
                      Format as JSON with keys: twitter_thread, linkedin, instagram, facebook`
                  },
                  {
                    role: 'user',
                    content: 'Title: {{$json["title"]}}\n\nContent: {{$json["content"]}}'
                  }
                ]
              }
            }
          }
        ]
      }
    }
  }
];