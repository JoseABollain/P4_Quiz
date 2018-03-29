const {models} = require('./model');
const {log, biglog, errorlog, colorize} = require("./out");
const Sequelize = require('sequelize');

exports.helpCmd = (socket, rl) => {
	log(socket, "Comandos:");
    log(socket, "  h|help - Muestra esta ayuda.");
    log(socket, "  list - Listar los quizzes existentes.");
    log(socket, "  show <id> - Muestra la pregunta y la respuesta del quiz indicado.");
    log(socket, "  add - Añadir un nuevo quiz interactivamente.");
    log(socket, "  delete <id> - Borrar el quiz indicado.");
    log(socket, "  edit <id> - Editar el quiz indicado.");
    log(socket, "  test <id> - Probar el quiz indicado.");
    log(socket, "  p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
    log(socket, "  credits - Créditos.");
    log(socket, "  q|quit - Salir del programa.");
    rl.prompt();
};

exports.listCmd = (socket, rl) => {
	models.quiz.findAll()
	.each(quiz => {
			log(socket, ` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
	})
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

const validateId = (socket, id) => {

	return new Sequelize.Promise((resolve, reject) => {
		if (typeof id === "undefined") {
			reject(new Error(`Falta el parámetro <id>.`));
		} else {
			id = parseInt(id);
			if (Number.isNaN(id)) {
				reject(new Error(`El valor del parámetro id no es un número`));
			} else {
				resolve(id);
			}
		}
	});
};

exports.showCmd = (socket, rl, id) => {
	validateId(socket, id)
	.then(id => models.quiz.findById(id))
	.then(quiz => {
		if (!quiz) {
			throw new Error(`No existe un quiz asociado al id=${id}.`);
		}
		log(socket, ` [${colorize(id, 'magenta')}]:  ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
	})
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

const makeQuestion = (socket, rl, text) => {

	return new Sequelize.Promise((resolve, reject) => {
		rl.question(colorize(text, 'red'), answer => {
			resolve(answer.trim());
		});
	});
};

exports.addCmd = (socket, rl) => {
	makeQuestion(socket, rl, ' Introduzca una pregunta: ')
	.then(q => {
		return makeQuestion(socket, rl, ' Introduzca la respuesta ')
		.then(a => {
			return {question: q, answer: a};
		});
	})
	.then(quiz => {
		return models.quiz.create(quiz);
	})
	.then(quiz => {
		log(socket, ` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
	})
	.catch(Sequelize.ValidationError, error => {
		errorlog(socket, 'El quiz es erróneo:');
		error.errors.forEach(({message}) => errorlog(socket, message));
	})
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

exports.deleteCmd = (socket, rl, id) => {
	validateId(socket, id)
	.then(id => models.quiz.destroy({where: {id}}))
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

exports.editCmd = (socket, rl, id) => {
	validateId(socket, id)
	.then(id => models.quiz.findById(id))
	.then(quiz => {
		if (!quiz) {
			throw new Error(`No existe un quiz asociado al id=${id}.`);
		}
		process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)},0);
		return makeQuestion(socket, rl, ' Introduzca la pregunta: ')
		.then(q => {
			process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)},0);
			return makeQuestion(socket, rl, ' Introduzca la respuesta: ')
			.then(a => {
				quiz.question = q;
				quiz.answer = a;
				return quiz;
			});
		});
	})
	.then(quiz => {
		return quiz.save();
	})
	.then(quiz => {
		log(socket, ` Se ha cambiado el quiz ${colorize(id, 'magenta')} por: ${question} ${colorize('=>', 'magenta')} ${answer}`);
	})
	.catch(Sequelize.ValidationError, error => {
		errorlog(socket, 'El quiz es erróneo.');
		error.errors.forEach(({message}) => errorlog(socket, message));
	})
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	});
};

exports.testCmd = (socket, rl, id) => {
	validateId(socket, id)
	.then(id => models.quiz.findById(id))
	.then(quiz => {
		if (!quiz) {
			throw new Error(`No existe un quiz asociado al id=${id}.`);
		}
		return makeQuestion(socket, rl, `¿${quiz.question}?`)
		.then(a => {
			if (quiz.answer.toLowerCase().trim() === a.toLowerCase().trim()) {
				log(socket, 'Su respuesta es correcta.');
				rl.prompt();
			} else {
				log(socket, 'Su respuesta es incorrecta.');
				rl.prompt();
			}
		});
	})
	.catch(Sequelize.ValidationError, error => {
		errorlog(socket, 'El quiz es erróneo:');
		error.errors.forEach(({message}) => errorlog(socket, message));
	})
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	});
};


exports.playCmd = (socket, rl) => {
	let toBeResolved = [];
	let score = 0;
	models.quiz.findAll()
	.then(quizzes => {
		for (let i = 0; i < quizzes.length; ++i) {
			toBeResolved[i] = quizzes[i];
		}
		PlayOne();
	})
	.catch(Sequelize.ValidationError, error => {
		errorlog(socket, 'El quiz es erróneo:');
		error.errors.forEach(({message}) => errorlog(socket, message));
	})
	.catch(error => {
		errorlog(socket, error.message);
	})
	.then(() => {
		rl.prompt();
	})
	const PlayOne = () => {
		if (toBeResolved.length === 0) {
			log(socket, `No hay nada más que preguntar. Fin del examen. Aciertos: ${score}`);
			rl.prompt();
		} else {
			let posicion = Math.round(Math.random() * (toBeResolved.length - 1));
			return makeQuestion(socket, rl, `¿${toBeResolved[posicion].question}?`)
			.then(a => {
				if (toBeResolved[posicion].answer.toLowerCase().trim() === a.toLowerCase().trim()) {
					score++;
					log(socket, `Respuesta correcta. Lleva ${score} aciertos.`);
					toBeResolved.splice(posicion, 1);
					PlayOne();
				} else {
					log(socket, `Respuesta incorrecta. Fin del examen. Aciertos: ${score}`);
					rl.prompt();
				}
			});
		}		
	}
};

exports.creditsCmd = (socket, rl) => {
	log(socket, 'Autores de la práctica:');
    log(socket, 'JOSE ANTONIO BOLLAIN GONZALEZ', 'green');
    rl.prompt();
};

exports.quitCmd = (socket, rl) => {
	rl.close();
	socket.end();
	rl.prompt();
};