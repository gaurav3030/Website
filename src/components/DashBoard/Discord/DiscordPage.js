import React, { useEffect, useState, useCallback, useContext } from "react";
import { Route, Redirect, Switch, withRouter } from "react-router-dom";
import firebase from "../../../firebase";
import Select from "react-select";
import useFetch from "../../../hooks/useFetch";
import SmallLoader from "../../Shared/SmallLoader";
import A from "../../Shared/A";
import useSnapshot from "../../../hooks/useSnapshot";

import { colorStyles, guildOption } from "../../Shared/userUtils";
import { AppContext } from "../../../contexts/Appcontext";
import { DiscordContextProvider, DiscordContext } from "../../../contexts/DiscordContext";
import PluginHome from "./Plugins/PluginHome";
import { useDocument } from "react-firebase-hooks/firestore";

const DiscordPage = React.memo(({ location, history, match }) => {
	const [displayGuild, setDisplayGuild] = useState();
	const [refreshed, setRefreshed] = useState(false);
	const { isLoading, sendRequest: sendLoadingRequest } = useFetch();
	const id = firebase.auth.currentUser.uid;
	const { sendRequest } = useFetch();
	const { currentUser, setCurrentUser } = useContext(AppContext);
	const {
		userDiscordInfo,
		setUserDiscordInfo,
		userConnectedChannels,
		userConnectedGuildInfo,
		setUserConnectedChannels,
		setUserConnectedGuildInfo,
	} = useContext(DiscordContext);

	const [rawDiscordData, discordDataLoading, DiscordDataError] = useDocument(firebase.db.doc(`Streamers/${id}/discord/data`));

	useEffect(() => {
		if (discordDataLoading) return;
		setUserDiscordInfo(rawDiscordData?.data());
	}, [rawDiscordData, discordDataLoading, setUserDiscordInfo]);

	useEffect(() => {
		if (userConnectedGuildInfo?.name) {
			setDisplayGuild(guildOption(userConnectedGuildInfo));
		}
	}, [userConnectedGuildInfo]);

	const refreshToken = userDiscordInfo?.refreshToken;
	useEffect(() => {
		(async () => {
			if (!refreshToken || !id) return;
			if (refreshed) return console.log("already refreshed");
            console.log("refreshing");
            const otcData = (await firebase.db.collection("Secret").doc(id).get()).data()
            const otc = otcData?.value
			setRefreshed(true);
			const response = await fetch(`${process.env.REACT_APP_API_URL}/discord/token/refresh?token=${refreshToken}&id=${id}&otc=${otc}`);
			if (!response.ok) return;

            const json = await response.json();
            console.log({json})
			if (!json) return;
			await firebase.db
				.collection("Streamers")
				.doc(id || " ")
				.collection("discord")
				.doc("data")
				.update(json.userData);
		})();
	}, [id, refreshed, refreshToken]);

	const disconnect = useCallback(
		async fullDisconnet => {
			// if (!fullDisconnet) {
			setUserConnectedGuildInfo(prev => ({ ...prev, connected: false }));
			// } else {
			// 	setUserConnectedGuildInfo(null);
			// }
			firebase.db.collection("Streamers").doc(id).collection("discord").doc("data").update({
				connectedGuild: "",
				liveChatId: [],
			});
			firebase.db.collection("Streamers").doc(id).update({
				liveChatId: [],
			});
		},
		[id]
	);

	const disconnectAccount = useCallback(async () => {
		disconnect();
		firebase.db.collection("Streamers").doc(id).collection("discord").doc("data").set({});
		setCurrentUser(prev => ({ ...prev, discordData: {} }));
	}, [id, disconnect, setCurrentUser]);

	const guilds = userDiscordInfo?.guilds;
	useSnapshot(
		firebase.db.collection("Streamers").doc(id).collection("discord").doc("data"),
		async snapshot => {
			const data = snapshot.data();
			if (data) {
				const userData = (await firebase.db.collection("Streamers").doc(id).get()).data();
				const connectedGuildId = data.connectedGuild;
				const guildByName = guilds?.find?.(guild => guild.id === connectedGuildId);
				if (guildByName) {
					const guildId = guildByName.id;
					const value = await sendRequest(`${process.env.REACT_APP_API_URL}/ismember?guild=` + guildId);
					const channelReponse = await sendRequest(`${process.env.REACT_APP_API_URL}/getchannels?guild=` + guildId);
					setUserConnectedGuildInfo({
						name: guildByName.name,
						isMember: value?.result,
						icon: guildByName.icon,
						id: guildByName.id,
						channels: channelReponse,
						connectedChannels: channelReponse?.filter(channel => userData.liveChatId?.includes(channel.id)),
						connected: true,
					});
				}
			}
		},
		[id, guilds]
	);

	useSnapshot(
		firebase.db.collection("Streamers").doc(id).collection("discord").doc("data"),
		async snapshot => {
			const data = snapshot.data();
			if (data) {
				firebase.db
					.collection("Streamers")
					.doc(id || " ")
					.update({
						guildId: data.connectedGuild || "",
					});
			}
		},
		[id]
	);

	const Connectguild = useCallback(async () => {
		setUserConnectedGuildInfo(prev => ({ ...prev, connected: true }));
		firebase.db.collection("Streamers").doc(id).collection("discord").doc("data").update({
			connectedGuild: userConnectedGuildInfo.id,
		});
	}, [userConnectedGuildInfo, id, setUserConnectedGuildInfo]);

	const onGuildSelect = useCallback(
		async e => {
			const name = e.value;
			const guildByName = userDiscordInfo.guilds.find(guild => guild.name === name);
			const guildId = guildByName.id;
			const { result: isMember } = await sendLoadingRequest(`${process.env.REACT_APP_API_URL}/ismember?guild=` + guildId);
			const channelReponse = await sendLoadingRequest(`${process.env.REACT_APP_API_URL}/getchannels?guild=` + guildId);

			setUserConnectedGuildInfo({
				name,
				isMember,
				icon: guildByName.icon,
				id: guildByName.id,
				channels: channelReponse,
			});
		},
		[userDiscordInfo, sendLoadingRequest]
	);

	const onChannelSelect = useCallback(
		async e => {
			setUserConnectedGuildInfo(s => ({
				...s,
				connectedChannels:
					e?.map(c => ({
						id: c.value,
						name: c.label.props.children[0].props.children,
						parent: c.label.props.children[1].props.children,
					})) || [],
			}));
			await firebase.db
				.collection("Streamers")
				.doc(id)
				.update({
					liveChatId: e?.map(c => c.value) || [],
				});
			await firebase.db
				.collection("Streamers")
				.doc(id)
				.collection("discord")
				.doc("data")
				.update({
					liveChatId: e?.map(c => c.value) || [],
				});
		},
		[id]
	);

	return (
		<div>
			<h1>Discord Settings</h1>
			<h3>
				Connect your discord account to DisStreamChat to get discord messages in your client/overlay during stream. You can only connect one
				server at a time but you can connect as many channels in that server
			</h3>
			<hr />
			<div className="settings-body">
				{Object.keys(userDiscordInfo || {}).length ? (
					<>
						<div className="discord-header">
							<Select
								value={displayGuild}
								onChange={onGuildSelect}
								placeholder="Select Guild"
								options={userDiscordInfo?.guilds?.filter(guild => guild.permissions.includes("MANAGE_GUILD")).map(guildOption)}
								styles={colorStyles}
								isDisabled={!!userConnectedGuildInfo?.connected}
							/>
							<span>
								<img className="discord-profile" src={userDiscordInfo?.profilePicture} alt="" />
								<span className="discord-name">{userDiscordInfo?.name}</span>
							</span>
						</div>
						<div className="discord-body">
							{isLoading ? (
								<SmallLoader />
							) : userConnectedGuildInfo ? (
								<>
									{!userConnectedGuildInfo.isMember ? (
										<div className="not-member">
											<span className="error-color">DisStreamBot is not a member of this server</span>
											<a
												href={`https://discord.com/api/oauth2/authorize?client_id=702929032601403482&permissions=8&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F%3Fdiscord%3Dtrue&scope=bot&guild_id=${userConnectedGuildInfo?.id}`}
											>
												<button className="invite-link discord-settings-button">Invite it</button>
											</a>
										</div>
									) : (
										<>
											{userConnectedGuildInfo.connected ? (
												<>
													<h3>select channels to listen to</h3>
													<Select
														closeMenuOnSelect={false}
														onChange={onChannelSelect}
														placeholder="Select Channel"
														value={userConnectedGuildInfo.connectedChannels
															?.sort((a, b) => a.parent.localeCompare(b.parent))
															?.map(channel => ({
																value: channel.id,
																label: (
																	<>
																		<span>{channel.name}</span>
																		<span className="channel-category">{channel.parent}</span>
																	</>
																),
															}))}
														options={userConnectedGuildInfo.channels
															.sort((a, b) => a.parent.localeCompare(b.parent))
															.map(channel => ({
																value: channel.id,
																label: (
																	<>
																		<span>{channel.name}</span>
																		<span className="channel-category">{channel.parent}</span>
																	</>
																),
															}))}
														styles={{
															...colorStyles,
															container: styles => ({ ...styles, ...colorStyles.container }),
														}}
														isMulti
													/>
													<button onClick={disconnect} className="discord-settings-button ml-0 mt-1 warning-button">
														Disconnect Guild
													</button>
												</>
											) : (
												<>
													<span>
														This server is not connected to the DisStreamChat chat manager, connect it to get discord
														messages in your app and adjust your plugin settings
													</span>
													<button onClick={Connectguild} className="discord-settings-button warning-button">
														Connect it
													</button>
												</>
											)}
										</>
									)}
								</>
							) : (
								<button onClick={disconnectAccount} className="discord-settings-button ml-0 mt-1 warning-button">
									Disconnect Account
								</button>
							)}
							{userConnectedGuildInfo?.connected && <PluginHome match={match} />}
						</div>
					</>
				) : (
					<>
						You have not Connected your Discord Account
						<A
							newTab
							href={`https://discord.com/api/oauth2/authorize?client_id=702929032601403482&redirect_uri=${process.env.REACT_APP_REDIRECT_URI}%2F%3Fdiscord%3Dtrue&response_type=code&scope=identify%20guilds`}
						>
							<button className="discord-settings-button good-button">Connect It</button>
						</A>
						{/* You have not Connected your Discord Account<A newTab href="https://discord.com/api/oauth2/authorize?client_id=702929032601403482&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F%3Fdiscord%3Dtrue&response_type=code&scope=identify%20connections"><button className="discord-settings-button good-button">Connect It</button></A> */}
					</>
				)}
			</div>
		</div>
	);
});

const IntermediateDiscordPage = props => {
	return (
		<DiscordContextProvider>
			<DiscordPage {...props} />
		</DiscordContextProvider>
	);
};

export default withRouter(React.memo(IntermediateDiscordPage));
