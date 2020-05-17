import React from 'react';
import "./Home.css"

import {Link} from "react-router-dom"

const Home = () => {
    return (
        <main className="home">
            <div className="header-area">
                <h1 className="body-header">Integrate your Discord server with Twitch</h1>
                <h3 className="body-subheader">Chat, Qna’s, Polls, Games and much more easily Integrated with Twitch and Discord!</h3>
            </div>
            <div className="buttons">
                <Link to="/invite" target="_blank" rel="noreferrer noopener" className="discord-button"><img src={`${process.env.PUBLIC_URL}/discord.png`} alt="custom discord logo"></img>Add To Discord</Link>
                <Link to="/about" className="about-button">See How It Works</Link>
            </div>
        </main>
    );
}

export default Home;