	PC.fe.config = PC.fe.config || PC_config.config;
	PC.fe.config = _.extend( {}, PC.fe.config);
	PC.fe.products_content = PC.fe.products_content || [];
	PC.fe.headless = false;
	// Alias for PC.fe.modal (session/controller). Block work can use this name instead of "modal".
	PC.fe.ui = PC.fe.ui || null;
