import React, {useState} from "react";

const ClassRoom = () => {
    const [name, setName] = useState("");
    const [fatherName, setFatherName] = useState("");

    const handleSubmit= (e) => {
        e.preventDefault();

    };

    return (
        <div className="classroom-page">
            <div className="classroom-title">
                <h1>Enter your Details to know your ClassRoom</h1>
            </div>
            <form onSubmit={handleSubmit} className="classroom-form">
                <label>
                    <input type="text" placeholder="Enter your Name" value={name} onChange={(e) => setName(e.target.value)}/>
                </label>
                <label>
                    <input type="text" placeholder="Enter your Father's Name" value={fatherName} onChange={(e) => setFatherName(e.target.value)}/>
                </label>
                <button type="submit">Click Enter</button>
            </form>
        </div>
    );
}

export default ClassRoom;