import { List, Icon, Action, ActionPanel } from '@raycast/api';
import React from 'react';
import { AVAILABLE_MODELS } from '../../utils/requestyClient';
import { Chat } from '../Chat';

interface ModelSelectorProps {
	showNewChatOnly?: boolean;
}

export function ModelSelector({ showNewChatOnly = false }: ModelSelectorProps) {
	return (
		<List
			navigationTitle="Select Requesty Model"
		>
			{AVAILABLE_MODELS.map((model) => (
				<List.Item
					key={model}
					icon={getModelIcon(model)}
					title={getModelDisplayName(model)}
					subtitle={model}
					accessories={[{ text: showNewChatOnly ? "Start New Chat" : "Configure or Chat" }]}
					actions={
						<ActionPanel>
							<ActionPanel.Section>
								<Action.Push
									title="Start New Chat"
									icon={Icon.Message}
									target={<Chat model={model} newChat={true} />}
								/>
							</ActionPanel.Section>
						</ActionPanel>
					}
				/>
			))}
		</List>
	);
}

function getModelIcon(model: string): Icon {
	if (model.includes('claude')) return Icon.Stars;
	if (model.includes('gpt')) return Icon.Lightbulb;
	if (model.includes('gemini')) return Icon.Globe;
	return Icon.Terminal;
}

function getModelDisplayName(model: string): string {
	return model.split('/')[1].split('-').map(capitalize).join(' ');
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
