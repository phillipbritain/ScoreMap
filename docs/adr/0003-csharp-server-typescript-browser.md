# C# (ASP.NET Core) server, TypeScript browser app

ScoreMap's server is written in C# on ASP.NET Core, and the browser app in TypeScript. We considered TypeScript on both sides (one language, shared types) but chose C# for the server because it is the language the developer knows best. The browser stays in TypeScript because the 3D globe libraries are JavaScript. The cost is that data shapes are defined twice, once on each side of the connection.
