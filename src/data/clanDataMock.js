// src/data/clanDataMock.js

// Este objeto simula o "banco de dados" de clãs em memória.
export const CLAN_DATA_MOCK = {
    // Exemplo de clã pré-existente
    "ABC1234": {
        id: "ABC1234",
        name: "Os Destruidores",
        level: 3,
        xp: 1500,
        gold: 15000,
        members: [
            { userId: "123456789", username: "Usuário Mock 1", role: "LIDER", donated: 5000 },
            { userId: "987654321", username: "Usuário Mock 2", role: "MEMBRO", donated: 1000 },
        ],
        createdAt: "2023-10-01T00:00:00.000Z",
    }
};
