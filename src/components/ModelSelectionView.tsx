import { Action, ActionPanel, List } from '@raycast/api';
import React from 'react';
import { AVAILABLE_MODELS } from '../utils/requestyClient';
import { Chat } from './Chat';

export function ModelSelectionView() {
	return (
		<List searchBarPlaceholder="Search models...">
			{AVAILABLE_MODELS.map((model) => (
				<List.Item
					key={model}
					title={model}
					icon={model.includes('claude') ? '🟣' : model.includes('gpt') ? '🟢' : '🔵'}
					accessories={[{ text: '⌘ + Enter to chat' }]}
					actions={
						<ActionPanel>
							<Action.Push title="Start Chat" icon="💬" target={<Chat model={model} />} />
						</ActionPanel>
					}
				/>
			))}
		</List>
	);
}
